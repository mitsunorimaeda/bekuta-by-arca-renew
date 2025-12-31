// src/hooks/useAuth.ts
import { useState, useEffect, useCallback, useRef } from "react";
import type { User as AuthUser } from "@supabase/supabase-js";
import { supabase, User } from "../lib/supabase";

type ProfileStatus = "idle" | "loading" | "ok" | "error";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms)
    ),
  ]);
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);

  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("idle");
  const [profileError, setProfileError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true); // ✅ authLoading（App側ではこれだけ見ればOK）
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);

  const lastProfileUidRef = useRef<string | null>(null);

  const checkPasswordChangeRequired = (authUser: AuthUser) => {
    const requiresChange = authUser.user_metadata?.requires_password_change === true;
    setRequiresPasswordChange(requiresChange);
  };

  const fetchUserProfile = useCallback(async (userId: string) => {
    setProfileStatus("loading");
    setProfileError(null);

    // 同じUIDで無限に叩かない（onAuthStateChange連打対策）
    lastProfileUidRef.current = userId;

    // 軽いリトライ（Supabaseが一瞬重い/502の時に効く）
    const delays = [0, 700, 1500, 3000]; // 合計～5秒ちょい
    let lastErr: any = null;

    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) await sleep(delays[i]);

      try {
        const { data, error } = await withTimeout(
          supabase.from("users").select("*").eq("id", userId).maybeSingle(),
          8000,
          "fetchUserProfile"
        );

        if (error) {
          lastErr = error;
          continue;
        }

        setUserProfile(data ? (data as User) : null);
        setProfileStatus("ok");
        setProfileError(null);
        return;
      } catch (e: any) {
        lastErr = e;
        continue;
      }
    }

    // ここまで来たら失敗確定
    console.error("Error fetching user profile:", lastErr);
    setUserProfile(null);
    setProfileStatus("error");
    setProfileError(lastErr?.message ?? "プロフィールの取得に失敗しました");
  }, []);

  // 外から呼べる再取得
  const refreshUserProfile = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("refreshUserProfile: getUser error:", error);
      return;
    }
    const uid = data.user?.id;
    if (!uid) return;
    await fetchUserProfile(uid);
  }, [fetchUserProfile]);

  // 初期ロード（セッション復元）
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setLoading(true);

        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          "getSession"
        );

        if (cancelled) return;

        setUser(session?.user ?? null);

        if (session?.user) {
          checkPasswordChangeRequired(session.user);
          await fetchUserProfile(session.user.id);
        } else {
          setUserProfile(null);
          setProfileStatus("idle");
          setProfileError(null);
        }
      } catch (e) {
        console.error("init auth failed:", e);
        setUser(null);
        setUserProfile(null);
        setProfileStatus("error");
        setProfileError((e as any)?.message ?? "認証初期化に失敗しました");
      } finally {
        if (!cancelled) setLoading(false); // ✅ ここで必ずクルクル脱出
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        checkPasswordChangeRequired(nextUser);

        // 連打対策：同じUIDで status=loading なら飛ばす
        if (profileStatus === "loading" && lastProfileUidRef.current === nextUser.id) return;

        await fetchUserProfile(nextUser.id);
      } else {
        setUserProfile(null);
        setRequiresPasswordChange(false);
        setProfileStatus("idle");
        setProfileError(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUserProfile]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;

    // ※ onAuthStateChangeで profile を取りにいくのでここではOK
    if (data.user?.user_metadata?.requires_password_change) {
      setRequiresPasswordChange(true);
    }
    return data;
  };

  const changePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { requires_password_change: false },
    });
    if (error) throw error;
    setRequiresPasswordChange(false);
  };

  const acceptTerms = async () => {
    if (!user) throw new Error("User not logged in");

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("users")
      .update({ terms_accepted: true, terms_accepted_at: now })
      .eq("id", user.id);

    if (error) throw error;

    setUserProfile((prev) =>
      prev ? { ...prev, terms_accepted: true, terms_accepted_at: now } : prev
    );
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setUserProfile(null);
      setRequiresPasswordChange(false);
      setProfileStatus("idle");
      setProfileError(null);
      setLoading(false);
    }
  };

  return {
    user,
    userProfile,
    loading, // authLoading
    requiresPasswordChange,

    // ✅ 追加
    profileLoading: profileStatus === "loading",
    profileError,

    signIn,
    signOut,
    changePassword,
    acceptTerms,
    refreshUserProfile,
  };
}
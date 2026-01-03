// src/hooks/useAuth.ts
import { useEffect, useRef, useState, useCallback } from "react";
import type { User as AuthUser, Session } from "@supabase/supabase-js";
import { supabase, User } from "../lib/supabase";

type AuthLoadingState = "booting" | "ready";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// “ハードに落とさない” soft timeout（結果が遅ければ諦めるだけ）
async function softTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: any;
  try {
    const result = await Promise.race([
      p,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
    return result as T | null;
  } finally {
    clearTimeout(timer);
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);

  // ✅ loading は「authが見れたか」だけにする（profile取得で引っ張らない）
  const [loadingState, setLoadingState] = useState<AuthLoadingState>("booting");
  const loading = loadingState !== "ready";

  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);

  const mountedRef = useRef(true);
  const fetchSeqRef = useRef(0);

  const checkPasswordChangeRequired = (authUser: AuthUser) => {
    const requiresChange = authUser.user_metadata?.requires_password_change === true;
    setRequiresPasswordChange(requiresChange);
  };

  // --- users テーブルのプロフィール取得（新規作成直後の遅延を吸収してリトライ） ---
  const fetchUserProfile = useCallback(async (uid: string) => {
    const seq = ++fetchSeqRef.current;

    // 0.3s → 0.8s → 1.5s の3回くらいで十分
    const retryDelays = [0, 300, 800, 1500];

    for (let i = 0; i < retryDelays.length; i++) {
      if (!mountedRef.current) return;
      if (seq !== fetchSeqRef.current) return; // 古いリクエスト破棄

      if (retryDelays[i] > 0) await sleep(retryDelays[i]);

      // ここは “遅かったら諦める” で、UIを止めない
      const res = await softTimeout(
        supabase.from("users").select("*").eq("id", uid).maybeSingle(),
        8000
      );

      if (!mountedRef.current) return;
      if (seq !== fetchSeqRef.current) return;

      if (res === null) {
        // timeout（ネット/ローカル負荷）→ 次のループで再挑戦
        continue;
      }

      const { data, error } = res;

      if (error) {
        console.error("[useAuth] fetchUserProfile error:", error);
        // RLS/権限で弾かれてる可能性があるので、ここで打ち切り（無限リトライしない）
        setUserProfile(null);
        return;
      }

      if (data) {
        setUserProfile(data as User);
        return;
      }

      // dataがnull（まだ作られてない等）→ 次のループで再挑戦
    }

    // 最終的に取れなくても、authは生きてるので profile=null のままにする
    setUserProfile(null);
  }, []);

  const applySession = useCallback(
    async (session: Session | null) => {
      const u = session?.user ?? null;

      setUser(u);

      if (u) {
        checkPasswordChangeRequired(u);
        // ✅ profile取得は裏で（loadingを戻さない）
        fetchUserProfile(u.id);
      } else {
        setUserProfile(null);
        setRequiresPasswordChange(false);
      }
    },
    [fetchUserProfile]
  );

  // ✅ 外から呼べる「再取得」
  const refreshUserProfile = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("[useAuth] refreshUserProfile getUser error:", error);
        return;
      }
      const uid = data.user?.id;
      if (!uid) return;
      await fetchUserProfile(uid);
    } catch (e) {
      console.error("[useAuth] refreshUserProfile failed:", e);
    }
  }, [fetchUserProfile]);

  useEffect(() => {
    mountedRef.current = true;

    // 1) 先に購読（後から来るイベントを取りこぼさない）
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mountedRef.current) return;
      await applySession(session);
      if (mountedRef.current) setLoadingState("ready");
    });

    // 2) 初期セッション取得（✅ timeoutで “失敗扱い” にしない）
    (async () => {
      try {
        // “取れたら反映”、取れなくても onAuthStateChange に任せてOK
        const res = await softTimeout(supabase.auth.getSession(), 8000);
        if (!mountedRef.current) return;

        if (res?.data?.session) {
          await applySession(res.data.session);
        }
      } catch (e) {
        console.error("[useAuth] init getSession failed:", e);
      } finally {
        if (mountedRef.current) setLoadingState("ready");
      }
    })();

    return () => {
      mountedRef.current = false;
      sub?.subscription?.unsubscribe();
    };
  }, [applySession]);

  // --- ログイン ---
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;

    if (data.user?.user_metadata?.requires_password_change) {
      setRequiresPasswordChange(true);
    }
    return data;
  };

  // --- パスワード変更 ---
  const changePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { requires_password_change: false },
    });
    if (error) throw error;
    setRequiresPasswordChange(false);
    // profile側に何か反映したいなら refreshUserProfile 呼んでもOK
  };

  // --- ✅ 利用規約の同意を保存 ---
  const acceptTerms = async () => {
    if (!user) throw new Error("User not logged in");

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("users")
      .update({ terms_accepted: true, terms_accepted_at: now })
      .eq("id", user.id);

    if (error) {
      console.error("[useAuth] acceptTerms failed:", error);
      throw error;
    }

    setUserProfile((prev) =>
      prev ? { ...prev, terms_accepted: true, terms_accepted_at: now } : prev
    );
  };

  // --- ログアウト ---
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("[useAuth] signOut error:", e);
    } finally {
      setUser(null);
      setUserProfile(null);
      setRequiresPasswordChange(false);
      setLoadingState("ready");
    }
  };

  return {
    user,
    userProfile,
    loading,
    requiresPasswordChange,
    signIn,
    signOut,
    changePassword,
    acceptTerms,
    refreshUserProfile,
  };
}
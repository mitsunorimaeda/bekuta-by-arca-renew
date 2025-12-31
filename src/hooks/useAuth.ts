// src/hooks/useAuth.ts
import { useState, useEffect } from "react";
import type { User as AuthUser } from "@supabase/supabase-js";
import { supabase, User } from "../lib/supabase";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);

  // --- パスワード変更が必要かチェック ---
  const checkPasswordChangeRequired = (authUser: AuthUser) => {
    const requiresChange = authUser.user_metadata?.requires_password_change === true;
    setRequiresPasswordChange(requiresChange);
  };

  // ✅ Promise タイムアウト
  const withTimeout = async <T,>(
    p: Promise<T>,
    ms: number,
    label: string
  ): Promise<T> => {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms)
      ),
    ]);
  };

  // --- ユーザープロフィール読込 (users テーブル) ---
  const fetchUserProfileSafe = async (userId: string) => {
    try {
      const { data, error } = await withTimeout(
        supabase.from("users").select("*").eq("id", userId).maybeSingle(),
        8000,
        "fetchUserProfile"
      );

      if (error) {
        console.error("Error fetching user profile:", error);
        setUserProfile(null);
        return;
      }

      setUserProfile(data ? (data as User) : null);
    } catch (e) {
      console.error("fetchUserProfile failed:", e);
      setUserProfile(null);
    }
  };

  // ✅ 外から呼べるようにした「再取得」
  const refreshUserProfile = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("refreshUserProfile: getUser error:", error);
        return;
      }
      const uid = data.user?.id;
      if (!uid) return;

      await fetchUserProfileSafe(uid);
    } catch (e) {
      console.error("refreshUserProfile failed:", e);
    }
  };

  // ✅ 初期ロード（無限クルクル防止）
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setLoading(true);

        const {
          data: { session },
          error,
        } = await withTimeout(supabase.auth.getSession(), 8000, "getSession");

        if (cancelled) return;

        if (error) {
          console.error("getSession error:", error);
        }

        setUser(session?.user ?? null);

        if (session?.user) {
          checkPasswordChangeRequired(session.user);
          await fetchUserProfileSafe(session.user.id);
        } else {
          setUserProfile(null);
        }
      } catch (e) {
        console.error("init auth failed:", e);
        if (!cancelled) {
          setUser(null);
          setUserProfile(null);
          setRequiresPasswordChange(false);
        }
      } finally {
        if (!cancelled) setLoading(false); // ✅ 必ずクルクル脱出
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        setLoading(true);

        setUser(session?.user ?? null);

        if (session?.user) {
          checkPasswordChangeRequired(session.user);
          await fetchUserProfileSafe(session.user.id);
        } else {
          setUserProfile(null);
          setRequiresPasswordChange(false);
        }
      } catch (e) {
        console.error("onAuthStateChange failed:", e);
        if (!cancelled) {
          setUser(null);
          setUserProfile(null);
          setRequiresPasswordChange(false);
        }
      } finally {
        if (!cancelled) setLoading(false); // ✅ ここも必ず脱出
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // --- ログイン ---
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (data.user?.user_metadata?.requires_password_change) {
        setRequiresPasswordChange(true);
      }

      return data;
    } catch (error) {
      console.error("Sign in error:", error);
      throw error;
    }
  };

  // --- パスワード変更 ---
  const changePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { requires_password_change: false },
    });

    if (error) throw error;

    setRequiresPasswordChange(false);
  };

  // --- ✅ 利用規約の同意を保存（terms_accepted / terms_accepted_at） ---
  const acceptTerms = async () => {
    if (!user) throw new Error("User not logged in");

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("users")
      .update({
        terms_accepted: true,
        terms_accepted_at: now,
      })
      .eq("id", user.id);

    if (error) {
      console.error("Failed to update terms_accepted:", error);
      throw error;
    }

    setUserProfile((prev) =>
      prev
        ? {
            ...prev,
            terms_accepted: true,
            terms_accepted_at: now,
          }
        : prev
    );
  };

  // --- ログアウト ---
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setUserProfile(null);
      setRequiresPasswordChange(false);
      setLoading(false);
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
// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import type { User as AuthUser } from '@supabase/supabase-js';
import { supabase, User } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);

  
  // --- ユーザープロフィール読込 (users テーブル) ---
  const fetchUserProfile = async (userId: string) => {
    setLoading(true);

    // ✅ 8秒でタイムアウトして“固まり”を防ぐ
    const timeoutMs = 8000;
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("fetchUserProfile timeout")), timeoutMs)
    );

    try {
      const { data, error } = await Promise.race([
        supabase.from("users").select("*").eq("id", userId).maybeSingle(),
        timeout,
      ]);

      if (error) {
        console.error("Error fetching user profile:", error);
        setUserProfile(null);
        return;
      }

      setUserProfile(data ? (data as User) : null);
    } catch (e) {
      console.error("Unexpected error fetching user profile:", e);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 外から呼べるようにした「再取得」
  const refreshUserProfile = async () => {
    // いまのuser stateが取れない瞬間もあるので auth から確実に取る
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('refreshUserProfile: getUser error:', error);
      return;
    }
    const uid = data.user?.id;
    if (!uid) return;

    await fetchUserProfile(uid);
  };

  // 初期ロード
  useEffect(() => {
    // 初回セッション取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkPasswordChangeRequired(session.user);
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 認証状態変化の監視
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkPasswordChangeRequired(session.user);
        fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setRequiresPasswordChange(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- パスワード変更が必要かチェック ---
  const checkPasswordChangeRequired = (authUser: AuthUser) => {
    const requiresChange = authUser.user_metadata?.requires_password_change === true;
    setRequiresPasswordChange(requiresChange);
  };

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
      console.error('Sign in error:', error);
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
    if (!user) throw new Error('User not logged in');

    const now = new Date().toISOString();

    const { error } = await supabase
      .from('users')
      .update({
        terms_accepted: true,
        terms_accepted_at: now,
      })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to update terms_accepted:', error);
      throw error;
    }

    // ローカルの状態も更新
    setUserProfile((prev) =>
      prev
        ? {
            ...prev,
            terms_accepted: true,
            terms_accepted_at: now,
          }
        : prev,
    );
  };

  // --- ログアウト ---
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
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
    acceptTerms, // ← App から使う
    refreshUserProfile, // ✅ 追加
  };
}
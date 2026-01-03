import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { BekutaSplash } from "./BekutaSplash";

// ここはあなたのusersテーブルに合わせて必要なら調整
type UserProfile = any;

type Props = {
  children: React.ReactNode;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function ProfileGate({ children }: Props) {
  const [status, setStatus] = useState<"boot" | "loading" | "ready" | "error">("boot");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [errMsg, setErrMsg] = useState<string>("");

  // 「ドキッ」を防ぐため：エラー表示は少し遅らせる
  const [canShowError, setCanShowError] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setCanShowError(true), 1800); // 1.8秒まではスプラッシュ固定
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfileWithRetry() {
      try {
        setStatus("loading");
        setErrMsg("");

        // ✅ まずセッションが落ち着くのを待つ（ここがフラッシュの主犯になりやすい）
        const { data: sessionRes } = await supabase.auth.getSession();
        const user = sessionRes.session?.user;
        if (!user) {
          // ログイン直後で一瞬nullのことがあるので少し待って再確認
          await sleep(250);
          const { data: sessionRes2 } = await supabase.auth.getSession();
          const user2 = sessionRes2.session?.user;
          if (!user2) throw new Error("セッションを取得できませんでした");
        }

        const { data: sessionRes3 } = await supabase.auth.getSession();
        const u = sessionRes3.session?.user;
        if (!u) throw new Error("セッションを取得できませんでした");

        // ✅ リトライ（ネット/初期化遅延を吸収）
        const maxTry = 3;
        let lastErr: any = null;

        for (let i = 0; i < maxTry; i++) {
          try {
            const { data, error } = await supabase
              .from("users")
              .select("*")
              .eq("id", u.id)
              .single();

            if (error) throw error;

            if (cancelled) return;
            setProfile(data);
            setStatus("ready");
            return;
          } catch (e: any) {
            lastErr = e;
            // ちょいバックオフ（0.25s, 0.6s, 1.0s）
            const wait = i === 0 ? 250 : i === 1 ? 600 : 1000;
            await sleep(wait);
          }
        }

        throw lastErr ?? new Error("プロフィール取得に失敗しました");
      } catch (e: any) {
        if (cancelled) return;
        setStatus("error");
        setErrMsg(e?.message ?? "プロフィール取得に失敗しました");
      }
    }

    loadProfileWithRetry();

    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ ここで「エラー画面」じゃなく、Bekutaを出す
  if (status === "boot" || status === "loading") {
    return <BekutaSplash subtitle="マイページを準備しています…" />;
  }

  // ✅ エラーも、最初の1.8秒は出さない（ドキッ防止）
  if (status === "error" && !canShowError) {
    return <BekutaSplash subtitle="接続を確認しています…" />;
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="max-w-md w-full p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="text-xl font-bold text-gray-900 dark:text-white">Bekuta</div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            一時的にプロフィールの読み込みに失敗しました。通信状況を確認して再読み込みしてください。
          </p>
          <p className="mt-3 text-xs text-gray-400 break-words">{errMsg}</p>

          <div className="mt-5 flex gap-2">
            <button
              className="px-4 py-2 rounded-lg bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-sm font-semibold"
              onClick={() => window.location.reload()}
            >
              再読み込み
            </button>
            <button
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm"
              onClick={() => supabase.auth.signOut().then(() => window.location.href = "/")}
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>
    );
  }

  // status === "ready"
  // もし子コンポーネント側で profile 必須なら Context で渡すのもOK
  return <>{children}</>;
}
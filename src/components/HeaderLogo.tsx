"use client";

import { useRouter } from 'next/navigation';

export function HeaderLogo() {
  const router = useRouter();

  const handleClick = () => {
    // ホームへ移動
    router.push('/home');
    // PWA用に完全リロード
    setTimeout(() => {
      window.location.reload();
    }, 20);
  };

  return (
    <button onClick={handleClick} className="flex items-center">
      <img src="/logo/vector-logo.svg" alt="Bekuta" className="h-8" />
    </button>
  );
}
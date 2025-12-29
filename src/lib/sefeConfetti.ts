// 失敗しても絶対throwしない confetti
export async function fireConfettiSafe(options?: any) {
    try {
      // ここが「m is not a function」の温床になりやすいので防御
      const mod: any = await import("canvas-confetti");
  
      // ESM/CJS差を吸収
      const fn = typeof mod === "function"
        ? mod
        : typeof mod?.default === "function"
          ? mod.default
          : null;
  
      if (!fn) {
        console.warn("[confetti] not a function", mod);
        return;
      }
  
      fn(options ?? { particleCount: 80, spread: 60, origin: { y: 0.7 } });
    } catch (e) {
      console.warn("[confetti] failed safely", e);
    }
  }
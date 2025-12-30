// src/lib/stopCamera.ts
export function stopAllMediaStreams() {
    // もしどこかで window に stream を乗せてたら確実に止める
    const w = window as any;
  
    const candidates = [
      w.__cameraStream,
      w.__mediaStream,
      w.__stream,
    ].filter(Boolean);
  
    for (const s of candidates) {
      try {
        (s as MediaStream).getTracks().forEach((t) => t.stop());
      } catch {}
    }
  
    // ついでに、動画要素に刺さってる srcObject も外す（刺さってると生き残ることがある）
    document.querySelectorAll("video").forEach((v) => {
      try {
        const vv = v as HTMLVideoElement;
        const src = vv.srcObject as MediaStream | null;
        if (src) src.getTracks().forEach((t) => t.stop());
        vv.srcObject = null;
      } catch {}
    });
  }
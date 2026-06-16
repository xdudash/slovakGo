export interface ShareCardData {
  xp: number;
  label: string;
  streakDays: number;
  userName: string;
  correctCount?: number;
  totalCount?: number;
}

export async function generateShareCard(data: ShareCardData): Promise<Blob> {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#6f57e8");
  bg.addColorStop(1, "#2b17a8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Decorative circles
  ctx.save();
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(W + 40, -120, 380, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-60, H + 40, 320, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

  // App name
  ctx.font = `bold 48px ${family}`;
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText("Slovak Life", 80, 110);

  // XP number — dynamic size by digit count
  const xpStr = `+${data.xp}`;
  const xpSize = xpStr.length <= 3 ? 220 : xpStr.length === 4 ? 185 : 150;
  ctx.font = `bold ${xpSize}px ${family}`;
  ctx.fillStyle = "#ffd21f";
  ctx.fillText(xpStr, 72, 360);

  // XP label
  ctx.font = `bold 52px ${family}`;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(`XP ${data.label}`, 80, 440);

  // Streak
  ctx.font = `bold 56px ${family}`;
  ctx.fillStyle = "#fff";
  ctx.fillText(`Серія: ${data.streakDays} днів`, 80, 570);

  // Score (lesson mode)
  if (data.correctCount !== undefined && data.totalCount !== undefined) {
    ctx.fillText(`${data.correctCount}/${data.totalCount} правильно`, 80, 660);
  }

  // User name
  ctx.font = `40px ${family}`;
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(data.userName, 80, 870);

  // App URL
  ctx.font = `36px ${family}`;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText("slovaklife.app", 80, 980);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png");
  });
}

export async function shareOrDownloadCard(blob: Blob, shareText: string): Promise<void> {
  const file = new File([blob], "slovak-life-progress.png", { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text: shareText });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "slovak-life-progress.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

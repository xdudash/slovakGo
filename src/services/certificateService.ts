export function downloadCertificate(name: string, level: string): void {
  const W = 800, H = 560;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#f5f3ff");
  bg.addColorStop(1, "#ede9fe");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Outer border
  ctx.strokeStyle = "#7c3aed";
  ctx.lineWidth = 6;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  // Inner border
  ctx.strokeStyle = "#c4b5fd";
  ctx.lineWidth = 2;
  ctx.strokeRect(32, 32, W - 64, H - 64);

  // Corner accents
  const accentSize = 20;
  const corners = [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40]] as [number, number][];
  ctx.fillStyle = "#7c3aed";
  corners.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, accentSize / 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Brand
  ctx.fillStyle = "#7c3aed";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SlovakGO", W / 2, 78);

  // Certificate title
  ctx.fillStyle = "#4c1d95";
  ctx.font = "bold 38px serif";
  ctx.fillText("Сертифікат", W / 2, 155);

  // Subtitle
  ctx.fillStyle = "#6b7280";
  ctx.font = "16px sans-serif";
  ctx.fillText("Цей сертифікат підтверджує, що", W / 2, 205);

  // Name
  ctx.fillStyle = "#1a1a2e";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText(name, W / 2, 258);

  // Divider
  ctx.strokeStyle = "#c4b5fd";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(160, 282);
  ctx.lineTo(W - 160, 282);
  ctx.stroke();

  // Achievement text
  ctx.fillStyle = "#6b7280";
  ctx.font = "16px sans-serif";
  ctx.fillText("успішно завершив(ла) рівень", W / 2, 322);

  // Level badge
  ctx.fillStyle = "#7c3aed";
  ctx.beginPath();
  (ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect?.(
    W / 2 - 55, 340, 110, 54, 12
  ) ?? ctx.rect(W / 2 - 55, 340, 110, 54);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(level, W / 2, 378);

  // Date
  const dateStr = new Date().toLocaleDateString("uk-UA", { year: "numeric", month: "long", day: "numeric" });
  ctx.fillStyle = "#9ca3af";
  ctx.font = "13px sans-serif";
  ctx.fillText(dateStr, W / 2, 455);

  // Footer
  ctx.fillStyle = "#c4b5fd";
  ctx.font = "12px sans-serif";
  ctx.fillText("slovakgo.sk", W / 2, 510);

  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `SlovakGO_Certificate_${level}.png`;
  a.click();
}

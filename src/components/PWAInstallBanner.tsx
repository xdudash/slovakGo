import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Card, Button } from "./ui";

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>((window as any).deferredPrompt || null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Check if dismissed
    const isDismissed = localStorage.getItem("slovakgo.pwa-dismissed") === "true";
    setDismissed(isDismissed);

    // Detect iOS (iPhones, iPads, iPods)
    const userAgent = window.navigator.userAgent;
    const ios = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 0 || /iPad|iPhone|iPod/.test(userAgent);
    setIsIOS(ios);

    // Detect if already installed (standalone mode)
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
    setIsStandalone(standalone);

    // Listen to custom event for PWA prompt (dispatched in main.tsx)
    const handlePrompt = () => {
      setDeferredPrompt((window as any).deferredPrompt);
    };

    window.addEventListener("pwa-install-available", handlePrompt);
    return () => {
      window.removeEventListener("pwa-install-available", handlePrompt);
    };
  }, []);

  const showBanner = !dismissed && !isStandalone && (deferredPrompt || isIOS);

  if (!showBanner) return null;

  async function handleInstallPWA() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User choice: ${outcome}`);
    (window as any).deferredPrompt = null;
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    localStorage.setItem("slovakgo.pwa-dismissed", "true");
    setDismissed(true);
  }

  return (
    <section className="card pwa-install-banner" style={{ position: "relative", marginBottom: "16px", paddingRight: "36px" }}>
      <button 
        type="button" 
        onClick={handleDismiss} 
        style={{ 
          position: "absolute", 
          top: "12px", 
          right: "12px", 
          background: "none", 
          border: "none", 
          color: "var(--muted)", 
          cursor: "pointer",
          padding: "4px"
        }}
        aria-label="Закрити"
      >
        <X size={16} />
      </button>

      {deferredPrompt && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <strong style={{ fontSize: "1rem", color: "var(--fg)", display: "block", marginBottom: "4px" }}>
              Встановити SlovakGO
            </strong>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
              Додайте застосунок на головний екран для швидкого входу та економії інтернету.
            </p>
          </div>
          <Button onClick={handleInstallPWA} style={{ width: "fit-content", padding: "6px 12px", fontSize: "0.85rem" }}>
            Встановити застосунок
          </Button>
        </div>
      )}

      {isIOS && (
        <div style={{ fontSize: "0.85rem", color: "var(--fg)", display: "flex", flexDirection: "column", gap: "8px" }}>
          <strong style={{ fontSize: "0.95rem", display: "block" }}>
            Встановити SlovakGO на iPhone 📱
          </strong>
          <ol style={{ paddingLeft: "16px", margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
            <li>
              Якщо ви відкрили посилання через <strong>Telegram, Viber або Instagram</strong>: натисніть значок у кутку та виберіть <strong>«Відкрити в Safari»</strong>.
            </li>
            <li>
              У браузері <strong>Safari</strong> натисніть кнопку <strong>«Поділитися»</strong> (квадрат зі стрілкою вгору: <span style={{ fontSize: "1.1rem", verticalAlign: "middle" }}>📤</span>) внизу екрана.
            </li>
            <li>
              У списку виберіть <strong>«Додати на початковий екран»</strong> (або <strong>«На екран "Домой"»</strong> / <strong>Add to Home Screen</strong> <span style={{ fontSize: "1.1rem", verticalAlign: "middle" }}>➕</span>).
            </li>
          </ol>
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "./ui";
import { useT } from "../i18n";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
const installWindow = window as Window & {
  deferredPrompt?: InstallPrompt | null;
};

export function PWAInstallBanner() {
  const { t } = useT();
  const [deferredPrompt, setDeferredPrompt] = useState(
    installWindow.deferredPrompt ?? null,
  );
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem("slovakgo.pwa-dismissed") === "true");
    } catch {
      setDismissed(false);
    }
    const agent = navigator.userAgent;
    setIsIOS(
      (/Macintosh/i.test(agent) && navigator.maxTouchPoints > 0) ||
        /iPad|iPhone|iPod/.test(agent),
    );
    setIsStandalone(
      matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    );
    const handlePrompt = () =>
      setDeferredPrompt(installWindow.deferredPrompt ?? null);
    window.addEventListener("pwa-install-available", handlePrompt);
    return () =>
      window.removeEventListener("pwa-install-available", handlePrompt);
  }, []);

  if (dismissed || isStandalone || (!deferredPrompt && !isIOS)) return null;

  async function install() {
    if (!deferredPrompt) return;
    setInstalling(true);
    setError(false);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      installWindow.deferredPrompt = null;
      setDeferredPrompt(null);
    } catch {
      setError(true);
    } finally {
      setInstalling(false);
    }
  }

  return (
    <section className="pwa-install-banner">
      <Download size={21} aria-hidden="true" />
      <div className="pwa-install-copy">
        <strong>{t("student.experience.install_title")}</strong>
        <p>{t("student.experience.install_text")}</p>
        {isIOS ? (
          <details>
            <summary>{t("student.experience.install_how")}</summary>
            <ol>
              <li>{t("student.experience.install_step1")}</li>
              <li>{t("student.experience.install_step2")}</li>
              <li>{t("student.experience.install_step3")}</li>
            </ol>
          </details>
        ) : (
          <Button variant="secondary" loading={installing} onClick={install}>
            {t("student.experience.install_button")}
          </Button>
        )}
        {error && <p role="alert">{t("student.experience.install_error")}</p>}
      </div>
      <button
        type="button"
        className="pwa-dismiss"
        aria-label={t("student.experience.close")}
        onClick={() => {
          try {
            localStorage.setItem("slovakgo.pwa-dismissed", "true");
          } catch {
            /* Dismiss for this visit. */
          }
          setDismissed(true);
        }}
      >
        <X size={18} />
      </button>
    </section>
  );
}

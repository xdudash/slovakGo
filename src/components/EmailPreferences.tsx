import { useEffect, useState } from "react";
import { apiClient } from "../services/apiClient";
export function EmailPreferences() {
  const [consent, setConsent] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let alive = true; apiClient.getEmailPreferences().then(r => { if (alive) setConsent(r.marketingConsent); }).catch(() => { if (alive) setError("Не вдалося завантажити налаштування листів"); }); return () => { alive = false; }; }, []);
  async function change(value: boolean) {
    setBusy(true); setError("");
    try { const r = await apiClient.setMarketingConsent(value); setConsent(r.marketingConsent); }
    catch { setError("Не вдалося зберегти згоду. Спробуйте ще раз."); }
    finally { setBusy(false); }
  }
  return <section className="settings-section"><h3>Листи від SlovakGO</h3><label><input type="checkbox" checked={consent === true} disabled={busy || consent === null} onChange={e => change(e.target.checked)} /> Хочу отримувати поради, нагадування та новини електронною поштою</label><p>Згода добровільна. Відписатися можна тут або за посиланням у кожному маркетинговому листі. Повідомлення про оплату й безпеку надсилаються окремо.</p>{error && <p role="alert">{error}</p>}</section>;
}

import { useT } from "../i18n";
import { useEffect, useState } from "react";
import { apiClient } from "../services/apiClient";
export function EmailPreferences() {
  const { t } = useT();
  const [consent, setConsent] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let alive = true; apiClient.getEmailPreferences().then(r => { if (alive) setConsent(r.marketingConsent); }).catch(() => { if (alive) setError("student.app.emails_load_failed"); }); return () => { alive = false; }; }, []);
  async function change(value: boolean) {
    setBusy(true); setError("");
    try { const r = await apiClient.setMarketingConsent(value); setConsent(r.marketingConsent); }
    catch { setError("student.app.emails_save_failed"); }
    finally { setBusy(false); }
  }
  return <section className="settings-section"><h3>{t("student.app.emails_title")}</h3><label><input type="checkbox" checked={consent === true} disabled={busy || consent === null} onChange={e => change(e.target.checked)} /> {t("student.app.emails_consent")}</label><p>{t("student.app.emails_note")}</p>{error && <p role="alert">{t(error)}</p>}</section>;
}

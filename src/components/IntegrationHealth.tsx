import { useState } from "react";
import { apiRequest } from "../services/apiClient";
import { Button, Card } from "./ui";
interface Health {
  pricing: Array<{ plan: string; verified: boolean; amount?: number | null; currency?: string; interval?: string; error?: string }>;
  email: { status: string; from: string; cronConfigured: boolean; deliveries: Array<{ id: string; status: string; createdAt: string }>; attempts: Array<{ provider_id: string | null; status: string; created_at: string }>; runs: Array<{ id: string; started_at: string; finished_at: string | null; sent: number; failed: number }> };
}
export function IntegrationHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function check() {
    setBusy(true); setError("");
    try { setHealth(await apiRequest<Health>("/admin/integrations", {}, 25000)); }
    catch { setError("Не вдалося перевірити інтеграції"); }
    finally { setBusy(false); }
  }
  return <Card><h3>Оплата й автоматичні листи</h3><Button variant="secondary" disabled={busy} onClick={check}>Перевірити Stripe та пошту</Button>{error && <p role="alert">{error}</p>}{health && <>
    {health.pricing.map(p => <p key={p.plan}>{p.plan}: {p.verified ? "✓ тариф підтверджено" : "⚠ тариф не підтверджено"} · {p.amount != null ? `${p.amount / 100} ${p.currency}/${p.interval}` : p.error}</p>)}
    <p>Пошта: {health.email.status} · {health.email.from} · Cron: {health.email.cronConfigured ? "налаштований" : "не налаштований"}</p>
    <p>Accepted означає, що сервіс прийняв лист. Delivered підтверджує доставку на поштовий сервер. Якщо читання журналу заборонене, перевірте доставку в Resend.</p>
    <h4>Запуски автоматичних листів</h4>{health.email.runs.length === 0 && <p>Ще немає журналу запусків.</p>}{health.email.runs.map(r => <p key={r.id}>{r.started_at} · {r.finished_at ? `Надіслано: ${r.sent}, помилок: ${r.failed}` : "Запуск не завершено"}</p>)}
    <h4>Доставка за даними Resend</h4>{health.email.deliveries.map(d => <p key={d.id}>{d.createdAt} · {d.status} · {d.id}</p>)}
    <h4>Останні спроби застосунку</h4>{health.email.attempts.map((d, i) => <p key={i}>{d.created_at} · {d.status} · {d.provider_id ?? "без ID"}</p>)}
  </>}</Card>;
}

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "./ui";
import { useT } from "../i18n";
import { track } from "../services/analytics";
import { notificationPermission, requestNotificationPermission } from "../services/nativeNotifications";
import { markReminderPrime, reminderPrimeState } from "../services/reminderPrime";
import { selectCurrentUser, useAppStore } from "../store/useAppStore";

type Lang = "uk" | "ru" | "sk" | "en";
const TIMES = ["08:00", "12:30", "19:00", "21:00"] as const;

const copy: Record<Lang, { title: string; text: string; when: string; yes: string; no: string; note: string }> = {
  uk: {
    title: "Нагадати завтра?", text: "Одне коротке нагадування на день — і серія не згорить. Без спаму.",
    when: "Коли тобі зручно?", yes: "Так, нагадуй", no: "Не зараз", note: "Час і нагадування можна змінити в налаштуваннях.",
  },
  ru: {
    title: "Напомнить завтра?", text: "Одно короткое напоминание в день — и серия не сгорит. Без спама.",
    when: "Когда тебе удобно?", yes: "Да, напоминай", no: "Не сейчас", note: "Время и напоминания можно изменить в настройках.",
  },
  sk: {
    title: "Pripomenúť zajtra?", text: "Jedna krátka pripomienka denne a tvoja séria nezhorí. Žiadny spam.",
    when: "Kedy ti to vyhovuje?", yes: "Áno, pripomínaj", no: "Teraz nie", note: "Čas a pripomienky zmeníš v nastaveniach.",
  },
  en: {
    title: "Remind you tomorrow?", text: "One short reminder a day keeps your streak alive. No spam.",
    when: "What time suits you?", yes: "Yes, remind me", no: "Not now", note: "You can change the time or turn reminders off in Settings.",
  },
};

/**
 * Primer before the one-time iOS notification prompt. A refused system prompt can
 * never be shown again, so it is asked only after the learner says yes here.
 */
export function ReminderPrime({ onDone }: { onDone: () => void }) {
  const { lang: rawLang } = useT();
  const c = copy[(rawLang in copy ? rawLang : "uk") as Lang];
  const user = useAppStore((s) => selectCurrentUser(s.data, s.currentUserId));
  const updateUser = useAppStore((s) => s.updateUser);
  const [time, setTime] = useState(user?.settings.reminderTime || "19:00");
  const [busy, setBusy] = useState(false);

  // Nothing to ask when iOS already decided (granted, or denied and only Settings can change it).
  useEffect(() => {
    let active = true;
    void notificationPermission().then((permission) => {
      if (active && permission !== "prompt" && permission !== "prompt-with-rationale") {
        if (user) markReminderPrime(user.id, "done");
        onDone();
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [onDone, user]);

  useEffect(() => { track("notif_prime_view"); }, []);

  async function accept() {
    if (!user) return onDone();
    setBusy(true);
    let granted = false;
    try { granted = await requestNotificationPermission(); } catch { /* treated as not granted */ }
    updateUser({ settings: { ...user.settings, notificationsEnabled: granted, reminderTime: time } });
    window.dispatchEvent(new Event("slovakgo:notification-preferences"));
    markReminderPrime(user.id, "done");
    track("notif_permission", { granted, time });
    onDone();
  }

  function later() {
    // A second "Not now" (after lesson 3) is final.
    if (user) markReminderPrime(user.id, reminderPrimeState(user.id) === null ? "dismissed" : "done");
    track("notif_prime_dismiss");
    onDone();
  }

  return (
    <main className="plus-intro reminder-prime">
      <header className="plus-intro-head">
        <span className="reminder-prime-icon" aria-hidden="true"><Bell size={40} /></span>
        <h1>{c.title}</h1>
        <p>{c.text}</p>
      </header>
      <fieldset className="reminder-prime-times">
        <legend>{c.when}</legend>
        {TIMES.map((value) => (
          <label key={value} className={`reminder-prime-time${time === value ? " is-selected" : ""}`}>
            <input type="radio" name="reminder-time" value={value} checked={time === value} onChange={() => setTime(value)} />
            {value}
          </label>
        ))}
      </fieldset>
      <Button onClick={() => void accept()} disabled={busy} style={{ width: "100%" }}>{c.yes}</Button>
      <button type="button" className="plus-intro-skip" onClick={later} disabled={busy}>{c.no}</button>
      <p className="plus-intro-note">{c.note}</p>
    </main>
  );
}

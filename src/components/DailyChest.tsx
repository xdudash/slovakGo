import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Trophy, X } from "lucide-react";
import { DAILY_XP_GOAL, chestTasks, dailyFor } from "../../shared/economy";
import { useT } from "../i18n";
import { track } from "../services/analytics";
import { useAppStore } from "../store/useAppStore";
import { todayKey } from "../utils/date";
import { rewardsCopy, rewardsLang } from "./rewardsCopy";
import { CrownIcon } from "./UserAvatar";

function ChestArt({ open }: { open: boolean }) {
  return (
    <svg className={`chest-art${open ? " is-open" : ""}`} width="56" height="52" viewBox="0 0 56 52" aria-hidden="true">
      <rect x="6" y="22" width="44" height="26" rx="5" fill="#8A6CFF" />
      <rect x="6" y="22" width="44" height="6" fill="#6f57e8" />
      <g className="chest-lid">
        <path d="M6 22c0-9 6-15 22-15s22 6 22 15H6Z" fill="#A08BFF" />
        <rect x="6" y="18" width="44" height="5" fill="#6f57e8" />
      </g>
      <rect x="24" y="24" width="8" height="10" rx="2" fill="#FFD21F" stroke="#E0A800" />
      {open && <circle cx="28" cy="16" r="7" fill="#FFD21F" opacity="0.85" className="chest-glow" />}
    </svg>
  );
}

/** Three small tasks a day; finishing them opens a chest of crowns. */
export function DailyChest() {
  const { lang } = useT();
  const c = rewardsCopy[rewardsLang(lang)];
  const progress = useAppStore((s) => (s.currentUserId ? s.data.progress[s.currentUserId] : undefined));
  const claimChest = useAppStore((s) => s.claimChest);
  const [won, setWon] = useState<number | null>(null);
  if (!progress) return null;

  const today = todayKey();
  const daily = dailyFor(progress.daily, today);
  const xpToday = progress.xpDailyHistory?.[today] ?? 0;
  const tasks = chestTasks(daily, xpToday);
  const done = [tasks.lesson, tasks.practice, tasks.xp].filter(Boolean).length;
  const ready = done === 3 && !daily.claimed;

  function open() {
    const crowns = claimChest();
    if (crowns !== null) { setWon(crowns); track("chest_open", { crowns }); }
  }

  const rows = [
    { ok: tasks.lesson, label: c.taskLesson },
    { ok: tasks.practice, label: c.taskPractice, link: "/app/practice" },
    { ok: tasks.xp, label: `${c.taskXp} · ${Math.min(xpToday, DAILY_XP_GOAL)}/${DAILY_XP_GOAL}` },
  ];

  return (
    <section className={`daily-chest${ready ? " is-ready" : ""}${daily.claimed ? " is-claimed" : ""}`} aria-label={c.chestTitle}>
      <div className="daily-chest-head">
        <ChestArt open={daily.claimed} />
        <div>
          <strong>{c.chestTitle}</strong>
          <span>{won !== null ? c.chestWon(won) : daily.claimed ? c.chestTomorrow : ready ? c.chestDone : `${done}/3`}</span>
        </div>
      </div>
      {!daily.claimed && (
        <ul className="daily-chest-tasks">
          {rows.map((row) => (
            <li key={row.label} className={row.ok ? "is-done" : ""}>
              <span className="daily-chest-check" aria-hidden="true">{row.ok ? <Check size={13} /> : null}</span>
              {row.label}
              {!row.ok && row.link && <Link to={row.link} className="daily-chest-go">{c.goPractice}</Link>}
            </li>
          ))}
        </ul>
      )}
      {ready && <button type="button" className="daily-chest-open" onClick={open}><CrownIcon size={16} /> {c.chestOpen}</button>}
    </section>
  );
}

const seenKey = (userId: string) => `slovakgo.league-seen:${userId}`;

/** Celebrates a weekly top-3 place once, the first time the learner sees it. */
export function LeagueRewardBanner() {
  const { lang } = useT();
  const c = rewardsCopy[rewardsLang(lang)];
  const userId = useAppStore((s) => s.currentUserId);
  const latest = useAppStore((s) => (s.currentUserId ? s.data.progress[s.currentUserId]?.leagueRewards?.at(-1) : undefined));
  const [seen, setSeen] = useState(() => {
    try { return userId ? localStorage.getItem(seenKey(userId)) : null; } catch { return null; }
  });
  if (!userId || !latest || seen === latest.weekId) return null;

  function dismiss() {
    try { localStorage.setItem(seenKey(userId!), latest!.weekId); } catch { /* storage may be unavailable */ }
    setSeen(latest!.weekId);
  }

  return (
    <section className="league-reward" role="status">
      <Trophy size={26} aria-hidden="true" />
      <strong>{c.league(latest.rank, latest.crowns)}</strong>
      <button type="button" onClick={dismiss} aria-label={c.dismiss}><X size={18} /></button>
    </section>
  );
}

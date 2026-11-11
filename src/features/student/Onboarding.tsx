import { useEffect, useRef, useState, type ComponentType } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight, BookOpen, Briefcase, Bus, CheckCircle2, ChevronLeft, FileText, GraduationCap, House,
  MessageCircle, MessageSquare, Plane, Sparkles, Stethoscope, type LucideProps,
} from "lucide-react";
import { Button } from "../../components/ui";
import { useT } from "../../i18n";
import { lessonService } from "../../services/lessonService";
import { track } from "../../services/analytics";
import { selectCurrentUser, useAppStore } from "../../store/useAppStore";
import type { UserLevel } from "../../types";
import offerCopy from "../../../shared/offerCopy.json";
import "../../styles/start-onboarding.css";

type Step = "goal" | "pace" | "start" | "plan";
const STEPS: Step[] = ["goal", "pace", "start", "plan"];

/** Same order as the `student.goals` list in every locale. */
const GOAL_ICONS: ComponentType<LucideProps>[] = [MessageCircle, Briefcase, FileText, House, Stethoscope, GraduationCap, Bus, Plane, Sparkles];
const PACE_MINUTES = [5, 10, 15, 20];
/** Daily XP target for each pace; a typical lesson is worth 10–30 XP. */
const xpForMinutes = (minutes: number) => minutes * 2;

const MASCOT: Record<Step, { src: string; width: number; height: number }> = {
  goal: { src: "/brand/mascot-think.webp", width: 120, height: 116 },
  pace: { src: "/brand/mascot-wave.webp", width: 120, height: 111 },
  start: { src: "/brand/mascot-wave.webp", width: 120, height: 111 },
  plan: { src: "/brand/mascot-plan.webp", width: 128, height: 120 },
};

export function Onboarding() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { t, ta, lang } = useT();
  const data = useAppStore((state) => state.data);
  const userId = useAppStore((state) => state.currentUserId);
  const user = selectCurrentUser(data, userId);
  const goals = ta("student.goals");
  const [step, setStep] = useState<Step>("goal");
  const [goalIndex, setGoalIndex] = useState<number | null>(() => {
    const index = user?.goal ? goals.indexOf(user.goal) : -1;
    return index >= 0 ? index : null;
  });
  const [minutes, setMinutes] = useState(10);
  const [showLevels, setShowLevels] = useState(params.get("start") === "known");
  const [level, setLevel] = useState<UserLevel | null>(null);
  const [startLevel, setStartLevel] = useState<UserLevel | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const levels = lessonService.levels.filter((value) => value !== "A0" && lessonService.byLevel(data.lessons, value).length > 0);

  useEffect(() => { heading.current?.focus(); }, [step, showLevels]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.onboardingDone) return <Navigate to="/app/path" replace />;

  const goal = goals[goalIndex ?? goals.length - 1];
  const stepNumber = STEPS.indexOf(step) + 1;

  function savePreferences() {
    const current = useAppStore.getState();
    const me = selectCurrentUser(current.data, current.currentUserId);
    if (!me) return;
    current.updateUser({ goal, settings: { ...me.settings, dailyGoal: xpForMinutes(minutes) } });
  }

  function chooseGoal(index: number) {
    setGoalIndex(index);
    track("onboarding_goal", { goal: goals[index] });
    setStep("pace");
  }

  function chooseStart(selectedLevel: UserLevel) {
    setStartLevel(selectedLevel);
    setStep("plan");
  }

  function finish() {
    if (!startLevel) return;
    savePreferences();
    track("onboarding_done", { goal, minutes, start: startLevel, via: startLevel === "A0" ? "beginner" : "self_selected" });
    useAppStore.getState().completeOnboarding(goal, startLevel);
    const state = useAppStore.getState();
    const first = state.data.lessons.find((lesson) => lesson.id === state.data.progress[userId!]?.currentLessonId);
    navigate(first && !first.contentLocked ? `/app/lesson/${first.id}` : "/app/path", { replace: true });
  }

  function openTest() {
    // The test finishes onboarding itself, so persist the answers first.
    savePreferences();
    navigate("/placement-test");
  }

  function goBack() {
    if (step === "start" && showLevels && params.get("start") !== "known") { setShowLevels(false); return; }
    setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)]);
  }

  const mascot = MASCOT[step];
  const titleKey = step === "goal" ? "goal_question" : step === "pace" ? "pace_title" : step === "plan" ? "plan_title" : showLevels ? "level_title" : "start_title";
  const textKey = step === "goal" ? "goal_hint" : step === "pace" ? "pace_hint" : step === "plan" ? "plan_text" : showLevels ? "level_text" : "start_text";

  return (
    <main className="start-onboarding">
      <header className="start-onboarding-header">
        {step !== "goal" ? (
          <button type="button" className="start-back-icon" onClick={goBack} aria-label={t("student.onboarding.back")}>
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        ) : null}
        <div className="start-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={stepNumber}
          aria-label={t("student.onboarding.step").replace("{n}", String(stepNumber)).replace("{total}", String(STEPS.length))}>
          <span style={{ width: `${stepNumber / STEPS.length * 100}%` }} />
        </div>
      </header>
      <section className="start-onboarding-body" aria-labelledby="start-heading">
        <div className="start-heading">
          <img className="start-mascot" src={mascot.src} alt="" width={mascot.width} height={mascot.height} />
          <h1 id="start-heading" ref={heading} tabIndex={-1}>{t(`student.onboarding.${titleKey}`)}</h1>
          <p>{t(`student.onboarding.${textKey}`)}</p>
        </div>

        {step === "goal" && (
          <div className="start-goals">
            {goals.map((value, index) => {
              const Icon = GOAL_ICONS[index] ?? Sparkles;
              return (
                <button key={value} type="button" className={`start-goal-card${goalIndex === index ? " selected" : ""}`} aria-pressed={goalIndex === index} onClick={() => chooseGoal(index)}>
                  <Icon size={22} aria-hidden="true" />
                  <span>{value}</span>
                </button>
              );
            })}
          </div>
        )}

        {step === "pace" && (
          <>
            <fieldset className="start-levels">
              <legend className="sr-only">{t("student.onboarding.pace_title")}</legend>
              {PACE_MINUTES.map((value, index) => (
                <label key={value} className={`start-level start-pace${minutes === value ? " selected" : ""}`}>
                  <input type="radio" name="daily-minutes" value={value} checked={minutes === value} onChange={() => setMinutes(value)} />
                  <strong>{t("student.onboarding.pace_minutes").replace("{n}", String(value))}</strong>
                  <span>{ta("student.onboarding.pace_tags")[index]}</span>
                </label>
              ))}
            </fieldset>
            <Button className="start-level-continue" onClick={() => { track("onboarding_pace", { minutes }); setStep("start"); }}>
              {t("student.onboarding.continue")}<ArrowRight size={18} aria-hidden="true" />
            </Button>
          </>
        )}

        {step === "start" && (showLevels ? (
          <>
            <fieldset className="start-levels">
              <legend className="sr-only">{t("student.onboarding.level_title")}</legend>
              {levels.map((value) => (
                <label key={value} className={`start-level${level === value ? " selected" : ""}`}>
                  <input type="radio" name="starting-level" value={value} checked={level === value} onChange={() => setLevel(value)} />
                  <strong>{value}</strong>
                  <span>{t(`student.onboarding.levels.${value}`)}</span>
                </label>
              ))}
            </fieldset>
            {levels.length === 0 ? <p role="status">{t("student.onboarding.catalog_loading")}</p> : null}
            <Button className="start-level-continue" disabled={!level} onClick={() => level && chooseStart(level)}>
              {level ? `${t("student.onboarding.start_level")} ${level}` : t("student.onboarding.choose_level")}
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
            <div className="start-test-option">
              <FileText size={22} aria-hidden="true" />
              <div>
                <strong>{t("student.onboarding.unsure")}</strong>
                <p>{t("student.onboarding.test_text")}</p>
                <button type="button" className="start-text-link" onClick={openTest}>{t("student.onboarding.placement")}</button>
              </div>
            </div>
          </>
        ) : (
          <div className="start-choices">
            <button type="button" className="start-choice" onClick={() => chooseStart("A0")}>
              <span className="start-choice-icon"><BookOpen size={27} aria-hidden="true" /></span>
              <span className="start-choice-copy">
                <strong>{t("student.onboarding.beginner_title")}</strong>
                <span>{t("student.onboarding.beginner_text")}</span>
                <span className="start-choice-action">{t("student.onboarding.start_a0")}</span>
              </span>
              <ArrowRight size={22} aria-hidden="true" />
            </button>
            <button type="button" className="start-choice" onClick={() => setShowLevels(true)}>
              <span className="start-choice-icon"><MessageSquare size={27} aria-hidden="true" /></span>
              <span className="start-choice-copy">
                <strong>{t("student.onboarding.known_title")}</strong>
                <span>{t("student.onboarding.known_text")}</span>
                <span className="start-choice-action">{t("student.onboarding.choose_level")}</span>
              </span>
              <ArrowRight size={22} aria-hidden="true" />
            </button>
          </div>
        ))}

        {step === "plan" && startLevel && (
          <>
            <dl className="start-plan">
              <div><dt>{t("student.onboarding.plan_goal_label")}</dt><dd>{goal}</dd></div>
              <div><dt>{t("student.onboarding.plan_pace_label")}</dt><dd>{t("student.onboarding.pace_minutes").replace("{n}", String(minutes))}</dd></div>
              <div><dt>{t("student.onboarding.plan_start_label")}</dt>
                <dd>{startLevel === "A0" ? t("student.onboarding.plan_start_a0") : t("student.onboarding.plan_start_level").replace("{level}", startLevel)}</dd></div>
              <div className="start-plan-outcome"><dt>{t("student.onboarding.plan_outcome_label")}</dt>
                <dd>{ta("student.onboarding.plan_outcomes")[goalIndex ?? goals.length - 1]}</dd></div>
            </dl>
            <h2 className="start-plan-how-title">{t("student.onboarding.plan_how_title")}</h2>
            <ul className="start-plan-how">
              {ta("student.onboarding.plan_how").map((item) => <li key={item}><CheckCircle2 size={18} aria-hidden="true" />{item}</li>)}
            </ul>
            <div className="start-sticky-cta">
              <Button className="start-level-continue" onClick={finish}>
                {t("student.onboarding.plan_cta")}<ArrowRight size={18} aria-hidden="true" />
              </Button>
            </div>
          </>
        )}

        {step !== "goal" && <p className="start-free-note"><CheckCircle2 size={18} aria-hidden="true" />{offerCopy[lang].free}</p>}
      </section>
    </main>
  );
}

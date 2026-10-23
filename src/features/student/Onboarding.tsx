import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, CheckCircle2, ChevronLeft, FileText, MessageSquare } from "lucide-react";
import { Button } from "../../components/ui";
import { useT } from "../../i18n";
import { lessonService } from "../../services/lessonService";
import { track } from "../../services/analytics";
import { selectCurrentUser, useAppStore } from "../../store/useAppStore";
import type { UserLevel } from "../../types";
import offerCopy from "../../../shared/offerCopy.json";
import "../../styles/start-onboarding.css";

export function Onboarding() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { t, ta, lang } = useT();
  const data = useAppStore((state) => state.data);
  const userId = useAppStore((state) => state.currentUserId);
  const user = selectCurrentUser(data, userId);
  const goals = ta("student.goals");
  const [goal, setGoal] = useState(user?.goal || goals[0]);
  const [showLevels, setShowLevels] = useState(params.get("start") === "known");
  const [level, setLevel] = useState<UserLevel | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const levels = lessonService.levels.filter((value) => value !== "A0" && lessonService.byLevel(data.lessons, value).length > 0);

  useEffect(() => { heading.current?.focus(); }, [showLevels]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.onboardingDone) return <Navigate to="/app/path" replace />;

  function start(selectedLevel: UserLevel) {
    track("onboarding_done", { goal, start: selectedLevel, via: selectedLevel === "A0" ? "beginner" : "self_selected" });
    useAppStore.getState().completeOnboarding(goal, selectedLevel);
    const state = useAppStore.getState();
    const first = state.data.lessons.find((lesson) => lesson.id === state.data.progress[userId!]?.currentLessonId);
    navigate(first && !first.contentLocked ? `/app/lesson/${first.id}` : "/app/path", { replace: true });
  }

  function openTest() {
    // The test can finish onboarding later, so persist the optional goal first.
    useAppStore.getState().updateUser({ goal });
    navigate("/placement-test");
  }

  return (
    <main className="start-onboarding">
      <header className="start-onboarding-header">
        <img src="/apple-icon.png" alt="" width={36} height={36} />
        <span>SlovakGO</span>
      </header>
      <section className="start-onboarding-body" aria-labelledby="start-heading">
        {showLevels ? (
          <button type="button" className="start-back" onClick={() => setShowLevels(false)}>
            <ChevronLeft size={18} aria-hidden="true" />{t("student.onboarding.back_to_choices")}
          </button>
        ) : null}
        <div className="start-heading">
          <h1 id="start-heading" ref={heading} tabIndex={-1}>
            {t(`student.onboarding.${showLevels ? "level_title" : "start_title"}`)}
          </h1>
          <p>{t(`student.onboarding.${showLevels ? "level_text" : "start_text"}`)}</p>
        </div>

        {showLevels ? (
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
            <Button className="start-level-continue" disabled={!level} onClick={() => level && start(level)}>
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
            <button type="button" className="start-choice" onClick={() => start("A0")}>
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
        )}

        <label className="start-goal">
          <span>{t("student.onboarding.goal_optional")}</span>
          <select value={goal} onChange={(event) => setGoal(event.target.value)}>
            {goals.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <p className="start-free-note"><CheckCircle2 size={18} aria-hidden="true" />{offerCopy[lang].free}</p>
      </section>
    </main>
  );
}

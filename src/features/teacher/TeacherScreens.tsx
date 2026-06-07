import { useMemo, useState } from "react";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { Button, Card, Field, PageHeader } from "../../components/ui";
import { selectCurrentUser, useAppStore } from "../../store/useAppStore";
import { useT } from "../../i18n";
import type { Lesson, UserLevel } from "../../types";

export function TeacherLayout() {
  return (
    <AppShell role="teacher">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="lessons" element={<Lessons />} />
        <Route path="lessons/new" element={<Editor />} />
        <Route path="lessons/:lessonId/edit" element={<Editor />} />
        <Route path="stats" element={<Stats />} />
        <Route path="import-export" element={<ImportExport />} />
      </Routes>
    </AppShell>
  );
}

function useTeacherData() {
  const store = useAppStore();
  const user = selectCurrentUser(store.data, store.currentUserId);
  return { ...store, user };
}

function Dashboard() {
  const { data } = useTeacherData();
  const { t } = useT();
  const published = data.lessons.filter((lesson) => lesson.isPublished).length;
  const attempts = Object.values(data.progress).flatMap((progress) => progress.lessonAttempts);
  const mistakes = Object.values(data.progress).flatMap((progress) => progress.mistakes);
  return (
    <main className="page-content">
      <PageHeader title={t("teacher.dashboard.title")} subtitle={t("teacher.dashboard.subtitle")} />
      <div className="stats-grid">
        <Card><strong>{data.lessons.length}</strong><span>{t("teacher.dashboard.stat_lessons")}</span></Card>
        <Card><strong>{published}</strong><span>{t("teacher.dashboard.stat_published")}</span></Card>
        <Card><strong>{data.users.filter((user) => user.role === "student").length}</strong><span>{t("teacher.dashboard.stat_students")}</span></Card>
        <Card><strong>{attempts.length}</strong><span>{t("teacher.dashboard.stat_attempts")}</span></Card>
        <Card><strong>{mistakes.length}</strong><span>{t("teacher.dashboard.stat_mistakes")}</span></Card>
      </div>
    </main>
  );
}

function Lessons() {
  const navigate = useNavigate();
  const { data, upsertLesson, deleteLesson } = useTeacherData();
  const { t } = useT();
  return (
    <main className="page-content">
      <PageHeader title={t("teacher.lessons.title")} action={<Button onClick={() => navigate("/teacher/lessons/new")}>{t("teacher.lessons.new")}</Button>} />
      <div className="lesson-list">
        {data.lessons.map((lesson) => (
          <Card key={lesson.id} className="lesson-card">
            <div className="lesson-copy">
              <h3>{lesson.title}</h3>
              <p>{lesson.level} · {lesson.topic} · {lesson.words.length} {t("teacher.lessons.words")} · {lesson.exercises.length} {t("teacher.lessons.exercises")}</p>
            </div>
            <span className="status-pill">{lesson.isPublished ? t("teacher.lessons.published") : t("teacher.lessons.draft")}</span>
            <Button variant="secondary" onClick={() => navigate(`/teacher/lessons/${lesson.id}/edit`)}>{t("teacher.lessons.edit")}</Button>
            <Button variant="ghost" onClick={() => upsertLesson({ ...lesson, id: `${lesson.id}-copy-${Date.now()}`, title: `${lesson.title} ${t("teacher.lessons.copy")}`, order: data.lessons.length + 1 })}>{t("teacher.lessons.copy")}</Button>
            <Button variant="ghost" onClick={() => upsertLesson({ ...lesson, isPublished: !lesson.isPublished })}>{lesson.isPublished ? t("teacher.lessons.unpublish") : t("teacher.lessons.publish")}</Button>
            <Button variant="danger" onClick={() => deleteLesson(lesson.id)}>{t("teacher.lessons.delete")}</Button>
          </Card>
        ))}
      </div>
    </main>
  );
}

function blankLesson(): Lesson {
  const id = `lesson-${crypto.randomUUID()}`;
  return {
    id,
    level: "A0",
    title: "Новий урок",
    description: "",
    topic: "Побут",
    order: 999,
    xpReward: 12,
    estimatedMinutes: 7,
    isPublished: false,
    createdBy: "user-teacher",
    intro: "",
    words: [],
    exercises: [],
    updatedAt: new Date().toISOString()
  };
}

function Editor() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const { data, upsertLesson } = useTeacherData();
  const { t } = useT();
  const original = data.lessons.find((lesson) => lesson.id === lessonId);
  const [lesson, setLesson] = useState<Lesson>(original || blankLesson());
  const [wordSk, setWordSk] = useState("");
  const [wordUk, setWordUk] = useState("");
  const [json, setJson] = useState(JSON.stringify(original || lesson, null, 2));

  function addWord() {
    if (!wordSk.trim() || !wordUk.trim()) return;
    setLesson({
      ...lesson,
      words: [
        ...lesson.words,
        { id: `${lesson.id}-word-${lesson.words.length + 1}`, sk: wordSk, uk: wordUk, level: lesson.level, topic: lesson.topic, lessonId: lesson.id }
      ]
    });
    setWordSk("");
    setWordUk("");
  }

  function addExercise() {
    const first = lesson.words[0];
    if (!first) return;
    setLesson({
      ...lesson,
      exercises: [
        ...lesson.exercises,
        {
          id: `${lesson.id}-ex-${lesson.exercises.length + 1}`,
          lessonId: lesson.id,
          type: "multiple_choice_translation",
          question: `Що означає "${first.sk}"?`,
          options: lesson.words.map((word) => word.uk),
          correctAnswer: first.uk,
          wordIds: [first.id],
          order: lesson.exercises.length + 1
        }
      ]
    });
  }

  return (
    <main className="page-content">
      <PageHeader title={original ? t("teacher.editor.title_edit") : t("teacher.editor.title_new")} />
      <Card className="form-stack">
        <Field label={t("teacher.editor.field_title")} value={lesson.title} onChange={(event) => setLesson({ ...lesson, title: event.target.value })} />
        <Field label={t("teacher.editor.field_desc")} value={lesson.description} onChange={(event) => setLesson({ ...lesson, description: event.target.value })} />
        <Field label={t("teacher.editor.field_topic")} value={lesson.topic} onChange={(event) => setLesson({ ...lesson, topic: event.target.value })} />
        <label className="field"><span>{t("teacher.editor.field_level")}</span><select value={lesson.level} onChange={(event) => setLesson({ ...lesson, level: event.target.value as UserLevel })}>{["A0", "A1", "A2", "B1", "B2", "C1"].map((level) => <option key={level}>{level}</option>)}</select></label>
        <label className="toggle-row"><input type="checkbox" checked={lesson.isPublished} onChange={(event) => setLesson({ ...lesson, isPublished: event.target.checked })} /> {t("teacher.editor.field_published")}</label>
      </Card>
      <Card className="form-stack">
        <h2>{t("teacher.editor.words_heading")}</h2>
        <div className="inline-fields">
          <Field label={t("teacher.editor.word_sk")} value={wordSk} onChange={(event) => setWordSk(event.target.value)} />
          <Field label={t("teacher.editor.word_uk")} value={wordUk} onChange={(event) => setWordUk(event.target.value)} />
        </div>
        <Button variant="secondary" onClick={addWord}>{t("teacher.editor.add_word")}</Button>
        <div className="word-mini-list">{lesson.words.map((word) => <span key={word.id}>{word.sk} - {word.uk}</span>)}</div>
      </Card>
      <Card className="form-stack">
        <h2>{t("teacher.editor.exercises_heading")}</h2>
        <Button variant="secondary" onClick={addExercise}>{t("teacher.editor.add_exercise")}</Button>
        <p>{lesson.exercises.length} {t("teacher.editor.exercises_count")}</p>
      </Card>
      <Card className="form-stack">
        <h2>{t("teacher.editor.json_heading")}</h2>
        <textarea value={json} onChange={(event) => setJson(event.target.value)} />
        <Button variant="secondary" onClick={() => setLesson(JSON.parse(json) as Lesson)}>{t("teacher.editor.import_json")}</Button>
      </Card>
      <Button onClick={() => { upsertLesson({ ...lesson, updatedAt: new Date().toISOString() }); navigate("/teacher/lessons"); }}>{t("teacher.editor.save")}</Button>
    </main>
  );
}

function Stats() {
  const { data } = useTeacherData();
  const { t } = useT();
  const rows = data.lessons.map((lesson) => {
    const attempts = Object.values(data.progress).flatMap((progress) => progress.lessonAttempts).filter((attempt) => attempt.lessonId === lesson.id);
    return { lesson, attempts };
  });
  return (
    <main className="page-content">
      <PageHeader title={t("teacher.stats.title")} />
      <Card>
        {rows.map(({ lesson, attempts }) => <div className="leader-row" key={lesson.id}><strong>{lesson.title}</strong><span>{attempts.length} {t("teacher.stats.attempts")}</span><span>{lesson.exercises.length} {t("teacher.stats.exercises")}</span></div>)}
      </Card>
    </main>
  );
}

function ImportExport() {
  const { data } = useTeacherData();
  const { t } = useT();
  const exportJson = useMemo(() => JSON.stringify({ lessons: data.lessons }, null, 2), [data.lessons]);
  return (
    <main className="page-content">
      <PageHeader title={t("teacher.import_export.title")} subtitle={t("teacher.import_export.subtitle")} />
      <Card>
        <textarea readOnly value={exportJson} />
      </Card>
    </main>
  );
}

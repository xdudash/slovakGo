import { useEffect, useRef, useState } from "react";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle, Bell, BookOpen, ChevronRight, Crown, Download,
  Eye, EyeOff, Medal, Search, Send, Trash2, Upload, UserRound, Users
} from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { Button, Card, Field, Modal, PageHeader } from "../../components/ui";
import { apiClient } from "../../services/apiClient";
import { selectCurrentUser, useAppStore } from "../../store/useAppStore";
import type { Exercise, Lesson, UserLevel, UserRole, Word } from "../../types";

export function AdminLayout() {
  return (
    <AppShell role="admin">
      <Routes>
        <Route path="/"             element={<Dashboard />} />
        <Route path="users"         element={<UsersScreen />} />
        <Route path="users/:userId" element={<UserDetail />} />
        <Route path="lessons"       element={<LessonsScreen />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="stats"         element={<Stats />} />
        <Route path="errors"        element={<Errors />} />
        <Route path="notify"        element={<NotifyScreen />} />
      </Routes>
    </AppShell>
  );
}

function useAdminData() {
  const store = useAppStore();
  const user = selectCurrentUser(store.data, store.currentUserId);
  return { ...store, user };
}

// ── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard() {
  const { data } = useAdminData();
  const navigate = useNavigate();
  const published = data.lessons.filter((l) => l.isPublished);
  const [summary, setSummary] = useState<{ totalUsers: number; active7d: number; plusUsers: number } | null>(null);

  useEffect(() => {
    apiClient.getAdminStats()
      .then((d) => setSummary({ totalUsers: d.summary.totalUsers, active7d: d.summary.active7d, plusUsers: d.summary.plusUsers }))
      .catch(() => undefined);
  }, []);

  return (
    <main className="page-content">
      <PageHeader title="Адмін-панель" subtitle="SlovakGO MVP" />
      <div className="admin-stats-grid">
        <Card className="admin-stat-card">
          <Users size={22} color="var(--accent)" />
          <strong>{summary?.totalUsers ?? "…"}</strong>
          <span>Користувачів</span>
        </Card>
        <Card className="admin-stat-card">
          <UserRound size={22} color="var(--success)" />
          <strong>{summary?.active7d ?? "…"}</strong>
          <span>Активні (7д)</span>
        </Card>
        <Card className="admin-stat-card">
          <Crown size={22} color="var(--yellow-dark)" />
          <strong>{summary?.plusUsers ?? "…"}</strong>
          <span>Plus</span>
        </Card>
        <Card className="admin-stat-card">
          <BookOpen size={22} color="var(--orange)" />
          <strong>{published.length} / {data.lessons.length}</strong>
          <span>Уроків (опубл.)</span>
        </Card>
      </div>

      <h3 className="admin-section-title">Швидкий доступ</h3>
      <div className="admin-quick-links">
        {[
          { icon: BookOpen, label: "Уроки та імпорт",       to: "/admin/lessons" },
          { icon: Users,    label: "Користувачі",            to: "/admin/users" },
          { icon: Crown,    label: "Підписки",               to: "/admin/subscriptions" },
          { icon: Bell,     label: "Push-сповіщення",        to: "/admin/notify" },
          { icon: Medal,    label: "Статистика (сервер)",    to: "/admin/stats" },
        ].map(({ icon: Icon, label, to }) => (
          <button key={to} type="button" className="admin-quick-link" onClick={() => navigate(to)}>
            <Icon size={20} />
            <span>{label}</span>
            <ChevronRight size={16} className="admin-quick-arrow" />
          </button>
        ))}
      </div>
    </main>
  );
}

// ── LESSONS SCREEN ───────────────────────────────────────────────────────────
type ImportState =
  | { phase: "idle" }
  | { phase: "preview"; lessons: Lesson[]; errors: string[] }
  | { phase: "done"; imported: number; updated: number };

function validateWord(raw: Record<string, unknown>, lessonId: string, idx: number): Word {
  if (!raw.sk || !raw.uk) throw new Error(`Слово #${idx + 1}: відсутнє sk або uk`);
  return {
    id:           String(raw.id    ?? `${lessonId}-word-${idx + 1}`),
    sk:           String(raw.sk),
    uk:           String(raw.uk),
    exampleSk:    raw.exampleSk   ? String(raw.exampleSk)   : undefined,
    exampleUk:    raw.exampleUk   ? String(raw.exampleUk)   : undefined,
    level:        (raw.level       ?? "A1") as UserLevel,
    topic:        String(raw.topic ?? ""),
    lessonId,
    audioUrl:     raw.audioUrl     ? String(raw.audioUrl)     : undefined,
    transcription: raw.transcription ? String(raw.transcription) : undefined,
    tags:         Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
  };
}

function validateExercise(raw: Record<string, unknown>, lessonId: string, idx: number): Exercise {
  const VALID_TYPES = [
    "multiple_choice_translation","reverse_translation","audio_choice","match_pairs",
    "true_false","fill_blank","sentence_ordering","typing","mistake_review",
  ];
  
  let type = String(raw.type ?? "multiple_choice_translation");
  
  // Backward compatibility for old JSON exports
  if (type === "multiple_choice" || type === "multiple_choice_reading") {
    type = "multiple_choice_translation";
  } else if (type === "mini_situation") {
    // Treat old mini situations as fill_blank or translation depending on the data
    type = "multiple_choice_translation";
  }
  
  if (!VALID_TYPES.includes(type)) throw new Error(`Вправа #${idx + 1}: невідомий тип "${type}"`);
  
  return {
    id:            String(raw.id      ?? `${lessonId}-ex-${idx + 1}`),
    lessonId,
    type:          type as Exercise["type"],
    question:      String(raw.question ?? ""),
    options:       Array.isArray(raw.options) ? (raw.options as string[]) : undefined,
    correctAnswer: Array.isArray(raw.correctAnswer)
      ? (raw.correctAnswer as string[])
      : String(raw.correctAnswer ?? ""),
    explanation:   raw.explanation ? String(raw.explanation)  : undefined,
    wordIds:       Array.isArray(raw.wordIds)   ? (raw.wordIds   as string[]) : undefined,
    audioUrl:      raw.audioUrl    ? String(raw.audioUrl)     : undefined,
    imageUrl:      raw.imageUrl    ? String(raw.imageUrl)     : undefined,
    order:         Number(raw.order ?? idx + 1),
    difficulty:    raw.difficulty ? (raw.difficulty as Exercise["difficulty"]) : undefined,
  };
}

function validateLesson(raw: unknown): Lesson {
  const r = raw as Record<string, unknown>;
  if (!r.id)    throw new Error(`Урок без id`);
  if (!r.title) throw new Error(`Урок "${r.id}" без title`);
  if (!r.level) throw new Error(`Урок "${r.id}" без level`);
  const id = String(r.id);
  const words     = Array.isArray(r.words)     ? r.words.map((w, i) => validateWord(w as Record<string, unknown>, id, i))     : [];
  const exercises = Array.isArray(r.exercises) ? r.exercises.map((e, i) => validateExercise(e as Record<string, unknown>, id, i)) : [];
  return {
    id,
    level:              (r.level ?? "A1") as UserLevel,
    title:              String(r.title),
    description:        String(r.description    ?? ""),
    topic:              String(r.topic          ?? ""),
    order:              Number(r.order          ?? 0),
    xpReward:           Number(r.xpReward       ?? 15),
    estimatedMinutes:   Number(r.estimatedMinutes ?? 8),
    isPublished:        Boolean(r.isPublished   ?? false),
    isLocked:           Boolean(r.isLocked      ?? false),
    createdBy:          r.createdBy ? String(r.createdBy) : undefined,
    intro:              r.intro              ? String(r.intro)              : undefined,
    completionMessage:  r.completionMessage  ? String(r.completionMessage) : undefined,
    words,
    exercises,
    updatedAt:          String(r.updatedAt ?? new Date().toISOString()),
  };
}

function parseImportJson(text: string): { lessons: Lesson[]; errors: string[] } {
  const errors: string[] = [];
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { lessons: [], errors: ["Невалідний JSON"] }; }
  const arr: unknown[] = Array.isArray(raw) ? raw : (raw as Record<string, unknown>).lessons as unknown[];
  if (!Array.isArray(arr)) return { lessons: [], errors: ["JSON має містити масив або об'єкт з полем lessons"] };
  const lessons: Lesson[] = [];
  for (const item of arr) {
    try { lessons.push(validateLesson(item)); }
    catch (err) { errors.push((err as Error).message); }
  }
  return { lessons, errors };
}

function exportJson(lessons: Lesson[]) {
  const blob = new Blob([JSON.stringify({ lessons }, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `lessons-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

interface AdminServerUser {
  id: string; email: string; name: string; avatar: string | null;
  role: string; level: string; country: string;
  subscriptionStatus: string; isBlocked: boolean;
  createdAt: string; lastSeenAt: string | null;
  xpTotal: number; streakDays: number; completedCount: number;
}

function exportUsersCSV(users: AdminServerUser[]) {
  const BOM = "﻿";
  const headers = ["Ім'я", "Email", "Роль", "Рівень", "Підписка", "XP", "Серія", "Уроків завершено", "Остання активність"];
  const rows = users.map((u) => [
    `"${u.name.replace(/"/g, '""')}"`,
    u.email,
    u.role,
    u.level,
    u.subscriptionStatus,
    u.xpTotal,
    u.streakDays,
    u.completedCount,
    u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleDateString("uk-UA") : "—",
  ].join(","));
  const csv = BOM + [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const LEVEL_ORDER: UserLevel[] = ["A0", "A1", "A2", "B1", "B2", "C1"];

function LevelPill({ level }: { level: UserLevel }) {
  return <span className={`level-pill level-pill--${level.toLowerCase()}`}>{level}</span>;
}

function LessonsScreen() {
  const { data, upsertLesson, deleteLesson } = useAdminData();
  const [search,     setSearch]     = useState("");
  const [filterLvl,  setFilterLvl]  = useState<UserLevel | "all">("all");
  const [filterPub,  setFilterPub]  = useState<"all" | "published" | "draft">("all");
  const [importState, setImportState] = useState<ImportState>({ phase: "idle" });
  const [deleteId,   setDeleteId]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const lessons = data.lessons
    .filter((l) => filterLvl === "all" || l.level === filterLvl)
    .filter((l) => filterPub === "all" || (filterPub === "published" ? l.isPublished : !l.isPublished))
    .filter((l) => !search || l.title.toLowerCase().includes(search.toLowerCase()) || l.topic.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || a.order - b.order);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const { lessons: parsed, errors } = parseImportJson(e.target?.result as string);
      setImportState({ phase: "preview", lessons: parsed, errors });
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (importState.phase !== "preview") return;
    const existing = new Set(data.lessons.map((l) => l.id));
    let imported = 0, updated = 0;
    for (const lesson of importState.lessons) {
      if (existing.has(lesson.id)) updated++; else imported++;
      upsertLesson(lesson);
    }
    setImportState({ phase: "done", imported, updated });
  }

  function confirmDelete() {
    if (deleteId) { deleteLesson(deleteId); setDeleteId(null); }
  }

  return (
    <main className="page-content">
      <PageHeader title="Уроки" subtitle={`${data.lessons.length} уроків · ${data.lessons.filter((l) => l.isPublished).length} опубліковано`} />

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-search-box">
          <Search size={15} />
          <input placeholder="Пошук за назвою або темою…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="admin-toolbar-right">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Імпорт JSON
          </Button>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFile(f); e.target.value = ""; } }} />
          <Button variant="secondary" onClick={() => exportJson(data.lessons)}>
            <Download size={15} /> Експорт
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-filter-row">
        <div className="filter-row">
          {(["all", ...LEVEL_ORDER] as const).map((lvl) => (
            <button key={lvl} type="button"
              className={`chip chip--sm ${filterLvl === lvl ? "active" : ""}`}
              onClick={() => setFilterLvl(lvl)}>
              {lvl === "all" ? "Всі рівні" : lvl}
            </button>
          ))}
        </div>
        <div className="filter-row">
          {(["all", "published", "draft"] as const).map((s) => (
            <button key={s} type="button"
              className={`chip chip--sm ${filterPub === s ? "active" : ""}`}
              onClick={() => setFilterPub(s)}>
              {s === "all" ? "Всі" : s === "published" ? "Опубліковані" : "Чернетки"}
            </button>
          ))}
        </div>
      </div>

      {/* Lesson list */}
      <div className="admin-lesson-list">
        {lessons.length === 0 && (
          <Card><p style={{ textAlign: "center", color: "var(--muted)" }}>Нічого не знайдено</p></Card>
        )}
        {lessons.map((lesson) => (
          <div key={lesson.id} className="admin-lesson-row">
            <LevelPill level={lesson.level} />
            <div className="admin-lesson-info">
              <strong>{lesson.title}</strong>
              <span>{lesson.topic} · {lesson.words.length} слів · {lesson.exercises.length} вправ · {lesson.xpReward} XP</span>
            </div>
            <div className="admin-lesson-actions">
              <button
                type="button"
                className={`admin-icon-btn ${lesson.isPublished ? "published" : "draft"}`}
                title={lesson.isPublished ? "Зняти з публікації" : "Опублікувати"}
                onClick={() => upsertLesson({ ...lesson, isPublished: !lesson.isPublished, updatedAt: new Date().toISOString() })}>
                {lesson.isPublished ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button type="button" className="admin-icon-btn danger" title="Видалити"
                onClick={() => setDeleteId(lesson.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Import preview modal */}
      {importState.phase === "preview" && (
        <Modal onClose={() => setImportState({ phase: "idle" })}>
          <Card className="modal-card import-preview-card">
            <h2>Підтвердити імпорт</h2>
            {importState.errors.length > 0 && (
              <div className="import-errors">
                <AlertCircle size={15} />
                <div>
                  {importState.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              </div>
            )}
            {importState.lessons.length > 0 ? (
              <>
                <p className="import-summary">
                  Буде додано / оновлено <strong>{importState.lessons.length}</strong> уроків:
                </p>
                <div className="import-preview-list">
                  {importState.lessons.map((l) => (
                    <div key={l.id} className="import-preview-row">
                      <LevelPill level={l.level} />
                      <span>{l.title}</span>
                      <span className="import-meta">{l.words.length} сл · {l.exercises.length} вп</span>
                      {data.lessons.some((x) => x.id === l.id) && <span className="import-update-tag">оновлення</span>}
                    </div>
                  ))}
                </div>
                <Button onClick={confirmImport}>Імпортувати {importState.lessons.length} уроків</Button>
              </>
            ) : (
              <p>Не вдалося розпізнати жодного урока.</p>
            )}
            <Button variant="ghost" onClick={() => setImportState({ phase: "idle" })}>Скасувати</Button>
          </Card>
        </Modal>
      )}

      {/* Import done modal */}
      {importState.phase === "done" && (
        <Modal onClose={() => setImportState({ phase: "idle" })}>
          <Card className="modal-card">
            <div style={{ fontSize: "2.5rem" }}>✅</div>
            <h2>Імпорт завершено</h2>
            <p><strong>{importState.imported}</strong> нових · <strong>{importState.updated}</strong> оновлено</p>
            <Button onClick={() => setImportState({ phase: "idle" })}>Готово</Button>
          </Card>
        </Modal>
      )}

      {/* Delete confirm modal */}
      {deleteId && (
        <Modal onClose={() => setDeleteId(null)}>
          <Card className="modal-card">
            <Trash2 size={36} color="var(--red)" />
            <h2>Видалити урок?</h2>
            <p>«{data.lessons.find((l) => l.id === deleteId)?.title}» — цю дію не можна скасувати.</p>
            <Button variant="danger" onClick={confirmDelete}>Видалити</Button>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Скасувати</Button>
          </Card>
        </Modal>
      )}
    </main>
  );
}

// ── USERS SCREEN ─────────────────────────────────────────────────────────────
function UsersScreen() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [users, setUsers] = useState<AdminServerUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  function fetchUsers() {
    setLoading(true);
    apiClient.getAdminUsers({ search, role: roleFilter === "all" ? undefined : roleFilter, limit: 200 })
      .then((d) => { setUsers(d.users); setTotal(d.total); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchUsers(); }, [search, roleFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patchUser(id: string, patch: Parameters<typeof apiClient.directAdminUpdateUser>[1]) {
    await apiClient.directAdminUpdateUser(id, patch).catch(() => undefined);
    fetchUsers();
  }

  function cycleRole(current: string): UserRole {
    const roles: UserRole[] = ["student", "teacher", "admin"];
    return roles[(roles.indexOf(current as UserRole) + 1) % roles.length];
  }

  return (
    <main className="page-content">
      <PageHeader title="Користувачі" subtitle={loading ? "…" : `${total} акаунтів`} />
      <div className="admin-toolbar">
        <div className="admin-search-box">
          <Search size={15} />
          <input placeholder="Пошук за ім'ям або email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="admin-toolbar-right">
          <Button variant="secondary" onClick={() => exportUsersCSV(users)}>
            <Download size={15} /> Експорт CSV
          </Button>
        </div>
      </div>
      <div className="filter-row" style={{ marginBottom: 12 }}>
        {(["all", "student", "teacher", "admin"] as const).map((r) => (
          <button key={r} type="button" className={`chip chip--sm ${roleFilter === r ? "active" : ""}`}
            onClick={() => setRoleFilter(r)}>
            {r === "all" ? "Всі" : r}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: "var(--muted)" }}>Завантаження…</p>}
      <div className="admin-user-list">
        {users.map((u) => (
          <div key={u.id} className="admin-user-row" onClick={() => navigate(`/admin/users/${u.id}`)} role="button" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/admin/users/${u.id}`)}>
            <div className="admin-user-avatar">{u.avatar || u.name.slice(0, 2).toUpperCase()}</div>
            <div className="admin-user-info">
              <strong>{u.name}</strong>
              <span>{u.email}</span>
            </div>
            <div className="admin-user-badges">
              <span className={`admin-role-badge role-${u.role}`}>{u.role}</span>
              {u.subscriptionStatus === "plus" && <Crown size={14} color="var(--yellow-dark)" />}
              {u.isBlocked && <span className="admin-blocked-badge">заблок.</span>}
            </div>
            <div className="admin-user-stats">
              <span>{u.xpTotal} XP</span>
              <span>{u.streakDays}🔥</span>
            </div>
            <div className="admin-user-actions" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="chip chip--sm"
                onClick={() => patchUser(u.id, { role: cycleRole(u.role) })}
                title="Змінити роль">
                {u.role}
              </button>
              <button type="button" className={`chip chip--sm ${u.subscriptionStatus === "plus" ? "active" : ""}`}
                onClick={() => patchUser(u.id, { subscriptionStatus: u.subscriptionStatus === "plus" ? "free" : "plus" })}
                title="Перемкнути Plus">
                <Crown size={12} /> Plus
              </button>
              <button type="button" className={`chip chip--sm ${u.isBlocked ? "active" : ""}`}
                onClick={() => patchUser(u.id, { isBlocked: !u.isBlocked })}
                title="Блокування">
                {u.isBlocked ? "Розблок." : "Блок."}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

// ── USER DETAIL ──────────────────────────────────────────────────────────────
function UserDetail() {
  const { userId } = useParams();
  const { data, loginAsUser } = useAdminData();
  const navigate = useNavigate();

  type ServerUser = Awaited<ReturnType<typeof apiClient.getAdminUser>>;
  const [detail, setDetail] = useState<ServerUser | null>(null);
  const [loading, setLoading] = useState(true);

  function fetchDetail() {
    if (!userId) return;
    setLoading(true);
    apiClient.getAdminUser(userId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchDetail(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patchUser(patch: Parameters<typeof apiClient.directAdminUpdateUser>[1]) {
    if (!userId) return;
    await apiClient.directAdminUpdateUser(userId, patch).catch(() => undefined);
    fetchDetail();
  }

  if (loading) return (
    <main className="page-content">
      <PageHeader title="…" action={<button type="button" className="back-btn" onClick={() => navigate("/admin/users")}>←</button>} />
    </main>
  );

  if (!detail) return (
    <main className="page-content">
      <PageHeader title="Користувач не знайдений" action={<button type="button" className="back-btn" onClick={() => navigate("/admin/users")}>←</button>} />
    </main>
  );

  const { user: u, progress: p } = detail;

  // Lesson completion rate vs published lessons at user's level
  const totalLessons = data.lessons.filter((l) => l.isPublished && l.level === u.level).length;
  const completionPct = totalLessons > 0 ? Math.round((p.completedLessons.length / totalLessons) * 100) : 0;

  // Most mistakes by lesson
  const mistakesByLesson: Record<string, number> = {};
  for (const m of p.mistakes as Array<{ lessonId?: string }>) {
    if (m.lessonId) mistakesByLesson[m.lessonId] = (mistakesByLesson[m.lessonId] ?? 0) + 1;
  }
  const topMistakeLessons = Object.entries(mistakesByLesson)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([lessonId, count]) => ({ title: data.lessons.find((l) => l.id === lessonId)?.title ?? lessonId, count }));

  // XP last 7 days
  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { day: key.slice(5), xp: (p.xpDailyHistory as Record<string, number>)?.[key] ?? 0 };
  });
  const maxXp = Math.max(...last7.map((d) => d.xp), 1);

  return (
    <main className="page-content">
      <PageHeader
        title={u.name}
        subtitle={u.email}
        action={<button type="button" className="back-btn" onClick={() => navigate("/admin/users")}>←</button>}
      />

      {/* Key metrics */}
      <div className="admin-stats-grid">
        <Card className="admin-stat-card"><strong>{p.xpTotal}</strong><span>XP всього</span></Card>
        <Card className="admin-stat-card"><strong>{p.streakDays}🔥</strong><span>Серія</span></Card>
        <Card className="admin-stat-card"><strong>{p.completedLessons.length}</strong><span>Уроків</span></Card>
        <Card className="admin-stat-card"><strong>{completionPct}%</strong><span>Прогрес рівня</span></Card>
        <Card className="admin-stat-card"><strong>{p.hearts}/{p.maxHearts}</strong><span>Серця</span></Card>
        <Card className="admin-stat-card"><strong>{(p.mistakes as unknown[]).length}</strong><span>Помилок</span></Card>
      </div>

      {/* XP bar chart — last 7 days */}
      <h3 className="admin-section-title">XP за останні 7 днів</h3>
      <Card>
        <div className="user-xp-chart">
          {last7.map(({ day, xp }) => (
            <div key={day} className="user-xp-col">
              <span className="user-xp-val">{xp > 0 ? xp : ""}</span>
              <div className="user-xp-bar-wrap">
                <div className="user-xp-bar" style={{ height: `${Math.round((xp / maxXp) * 100)}%` }} />
              </div>
              <span className="user-xp-day">{day}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Profile info */}
      <h3 className="admin-section-title">Профіль</h3>
      <Card>
        <div className="admin-detail-row"><span>Роль</span><strong>{u.role}</strong></div>
        <div className="admin-detail-row"><span>Рівень</span><LevelPill level={u.level as UserLevel} /></div>
        <div className="admin-detail-row"><span>Підписка</span><strong>{u.subscriptionStatus}</strong></div>
        <div className="admin-detail-row"><span>Країна</span><strong>{u.country || "—"}</strong></div>
        <div className="admin-detail-row"><span>Реєстрація</span><strong>{new Date(u.createdAt).toLocaleDateString("uk-UA")}</strong></div>
        <div className="admin-detail-row"><span>Остання активність</span><strong>{u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleDateString("uk-UA") : "—"}</strong></div>
        <div className="admin-detail-row"><span>Заблокований</span><strong>{u.isBlocked ? "Так" : "Ні"}</strong></div>
        <div className="admin-detail-row"><span>Остання практика</span><strong>{p.lastPracticeDate || "—"}</strong></div>
      </Card>

      {/* Top mistake lessons */}
      {topMistakeLessons.length > 0 && (
        <>
          <h3 className="admin-section-title">Найбільше помилок</h3>
          <Card>
            {topMistakeLessons.map(({ title, count }) => (
              <div key={title} className="admin-detail-row">
                <span>{title}</span>
                <strong style={{ color: "var(--red)" }}>{count}×</strong>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* Actions */}
      <h3 className="admin-section-title">Керування</h3>
      <div className="admin-detail-actions">
        <Button variant="secondary" onClick={() => { loginAsUser(u.id); navigate("/app/path"); }}>
          <UserRound size={15} /> Увійти як {u.name}
        </Button>
        <Button variant="secondary" onClick={() => patchUser({ role: u.role === "student" ? "teacher" : "student" })}>
          Роль → {u.role === "student" ? "teacher" : "student"}
        </Button>
        <Button variant="secondary" onClick={() => patchUser({ subscriptionStatus: u.subscriptionStatus === "plus" ? "free" : "plus" })}>
          <Crown size={15} /> {u.subscriptionStatus === "plus" ? "Скасувати Plus" : "Видати Plus"}
        </Button>
        <Button variant={u.isBlocked ? "secondary" : "danger"} onClick={() => patchUser({ isBlocked: !u.isBlocked })}>
          {u.isBlocked ? "Розблокувати" : "Заблокувати"}
        </Button>
      </div>
    </main>
  );
}

// ── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
function Subscriptions() {
  const [search, setSearch] = useState("");
  const [allUsers, setAllUsers] = useState<AdminServerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const SUB_ORDER = ["plus", "trial", "free", "expired", "cancelled"];

  function fetchUsers() {
    setLoading(true);
    apiClient.getAdminUsers({ limit: 500 })
      .then((d) => setAllUsers(d.users))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchUsers(); }, []);

  async function patchUser(id: string, patch: Parameters<typeof apiClient.directAdminUpdateUser>[1]) {
    await apiClient.directAdminUpdateUser(id, patch).catch(() => undefined);
    fetchUsers();
  }

  const users = allUsers
    .filter((u) => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => SUB_ORDER.indexOf(a.subscriptionStatus) - SUB_ORDER.indexOf(b.subscriptionStatus));

  const counts = { plus: 0, trial: 0, free: 0, other: 0 };
  for (const u of allUsers) {
    if (u.subscriptionStatus === "plus") counts.plus++;
    else if (u.subscriptionStatus === "trial") counts.trial++;
    else if (u.subscriptionStatus === "free") counts.free++;
    else counts.other++;
  }

  return (
    <main className="page-content">
      <PageHeader title="Підписки" />
      <div className="admin-stats-grid">
        <Card className="admin-stat-card"><Crown size={20} color="var(--yellow-dark)" /><strong>{loading ? "…" : counts.plus}</strong><span>Plus</span></Card>
        <Card className="admin-stat-card"><strong>{loading ? "…" : counts.trial}</strong><span>Пробний</span></Card>
        <Card className="admin-stat-card"><strong>{loading ? "…" : counts.free}</strong><span>Безкоштовний</span></Card>
        <Card className="admin-stat-card"><strong>{loading ? "…" : counts.other}</strong><span>Інші</span></Card>
      </div>
      <div className="admin-toolbar">
        <div className="admin-search-box">
          <Search size={15} /><input placeholder="Пошук…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="admin-user-list">
        {users.map((u) => (
          <div key={u.id} className="admin-user-row">
            <div className="admin-user-avatar">{u.avatar || u.name.slice(0, 2).toUpperCase()}</div>
            <div className="admin-user-info"><strong>{u.name}</strong><span>{u.email}</span></div>
            <span className={`sub-badge sub-badge--${u.subscriptionStatus}`}>{u.subscriptionStatus}</span>
            <Button variant="secondary" onClick={() => patchUser(u.id, { subscriptionStatus: u.subscriptionStatus === "plus" ? "free" : "plus" })}>
              {u.subscriptionStatus === "plus" ? "Скасувати" : "Дати Plus"}
            </Button>
          </div>
        ))}
      </div>
    </main>
  );
}

// ── STATS ────────────────────────────────────────────────────────────────────
interface AdminStats {
  summary: { totalUsers: number; active24h: number; active7d: number; plusUsers: number; avgXP: number; avgStreak: number };
  levels: Record<string, number>;
  dailyRegistrations: Array<{ date: string; count: number }>;
  mistakeHeatmap: Record<string, { total: number; exercises: Record<string, number> }>;
  retention: Record<string, { total: number; d1: number; d7: number; d30: number }>;
}

function Stats() {
  const { data } = useAdminData();
  const [stats,   setStats]   = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    apiClient.getAdminStats()
      .then((d) => setStats(d as unknown as AdminStats))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="page-content"><PageHeader title="Статистика" /><p style={{ color: "var(--muted)" }}>Завантаження…</p></main>;
  if (error || !stats) return <main className="page-content"><PageHeader title="Статистика" /><p style={{ color: "var(--red)" }}>Не вдалося завантажити дані з сервера.</p></main>;

  const { summary, levels, dailyRegistrations, mistakeHeatmap, retention } = stats;

  return (
    <main className="page-content">
      <PageHeader title="Статистика 2.0" subtitle="Глибока аналітика" />
      
      {/* Key Metrics */}
      <div className="admin-stats-grid">
        <Card className="admin-stat-card"><strong>{summary.totalUsers}</strong><span>Всього</span></Card>
        <Card className="admin-stat-card"><strong>{summary.active24h}</strong><span>Активні (24г)</span></Card>
        <Card className="admin-stat-card"><strong>{summary.active7d}</strong><span>Активні (7д)</span></Card>
        <Card className="admin-stat-card"><strong>{summary.plusUsers}</strong><span>Plus</span></Card>
        <Card className="admin-stat-card"><strong>{summary.avgXP}</strong><span>Сер. XP</span></Card>
        <Card className="admin-stat-card"><strong>{summary.avgStreak}</strong><span>Сер. серія</span></Card>
      </div>

      {/* Retention Cohorts */}
      <h3 className="admin-section-title">Retention (когорти за місяцем)</h3>
      <Card className="admin-table-card">
        <table className="admin-retention-table">
          <thead>
            <tr>
              <th>Місяць</th>
              <th>Юзерів</th>
              <th>D1</th>
              <th>D7</th>
              <th>D30</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(retention).reverse().map(([month, row]) => (
              <tr key={month}>
                <td><strong>{month}</strong></td>
                <td>{row.total}</td>
                <td className={getRetentionClass(row.d1 / row.total)}>{Math.round((row.d1 / row.total) * 100)}%</td>
                <td className={getRetentionClass(row.d7 / row.total)}>{Math.round((row.d7 / row.total) * 100)}%</td>
                <td className={getRetentionClass(row.d30 / row.total)}>{Math.round((row.d30 / row.total) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Mistake Heatmap */}
      <h3 className="admin-section-title">Карта помилок (найскладніші уроки)</h3>
      <div className="admin-heatmap">
        {Object.entries(mistakeHeatmap).map(([lid, info]) => {
          const lesson = data.lessons.find((l) => l.id === lid);
          return (
            <Card key={lid} className="heatmap-card">
              <div className="heatmap-header">
                <strong>{lesson?.title || lid}</strong>
                <span className="heatmap-total">{info.total} помилок</span>
              </div>
              <div className="heatmap-bar-stack">
                {Object.entries(info.exercises).slice(0, 5).map(([eid, count]) => (
                  <div key={eid} className="heatmap-bar-wrap" title={`Вправа ${eid}: ${count} помилок`}>
                    <div 
                      className="heatmap-bar" 
                      style={{ height: `${Math.min(100, (count / info.total) * 300)}%` }} 
                    />
                  </div>
                ))}
              </div>
              <span className="heatmap-meta">{lesson?.topic} · {lesson?.level}</span>
            </Card>
          );
        })}
      </div>

      <div className="admin-stats-columns">
        <div className="stats-col">
          <h3 className="admin-section-title">За рівнями</h3>
          <Card>
            {["A0","A1","A2","B1","B2","C1"].map((lvl) => (
              <div key={lvl} className="admin-detail-row">
                <LevelPill level={lvl as UserLevel} />
                <div className="admin-bar-wrap">
                  <div className="admin-bar" style={{ width: `${Math.round(((levels[lvl] || 0) / (summary.totalUsers || 1)) * 100)}%` }} />
                </div>
                <span>{levels[lvl] || 0}</span>
              </div>
            ))}
          </Card>
        </div>
        <div className="stats-col">
          <h3 className="admin-section-title">Реєстрації за тиждень</h3>
          <Card>
            {dailyRegistrations.map((row) => (
              <div key={row.date} className="admin-detail-row">
                <span>{row.date}</span>
                <strong>+{row.count}</strong>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </main>
  );
}

function getRetentionClass(rate: number): string {
  if (rate >= 0.4) return "retention-high";
  if (rate >= 0.2) return "retention-mid";
  return "retention-low";
}

// ── ERRORS ───────────────────────────────────────────────────────────────────
type JsError = { id: string; userId: string | null; message: string; stack: string | null; url: string | null; createdAt: string };

function Errors() {
  const { data } = useAdminData();
  const [jsErrors, setJsErrors] = useState<JsError[]>([]);
  const [jsTotal, setJsTotal] = useState(0);
  const [jsLoading, setJsLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getAdminErrors(50)
      .then((r) => { setJsErrors(r.errors); setJsTotal(r.total); })
      .catch(() => undefined)
      .finally(() => setJsLoading(false));
  }, []);

  const mistakes = Object.values(data.progress).flatMap((p) => p.mistakes)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
  const byExercise: Record<string, { correct: string; wrongs: string[]; count: number }> = {};
  for (const m of mistakes) {
    if (!byExercise[m.exerciseId]) byExercise[m.exerciseId] = { correct: m.correctAnswer, wrongs: [], count: 0 };
    byExercise[m.exerciseId].wrongs.push(m.wrongAnswer);
    byExercise[m.exerciseId].count++;
  }
  const sortedMistakes = Object.entries(byExercise).sort(([, a], [, b]) => b.count - a.count);

  return (
    <main className="page-content">
      <PageHeader title="Помилки" subtitle="Застосунок і вправи" />

      <p className="admin-section-title">Помилки застосунку {jsTotal > 0 && <span className="admin-role-badge">{jsTotal}</span>}</p>
      <Card>
        {jsLoading
          ? <p style={{ color: "var(--muted)", textAlign: "center", padding: "12px 0" }}>Завантаження…</p>
          : jsErrors.length === 0
            ? <p style={{ color: "var(--muted)", textAlign: "center", padding: "12px 0" }}>JS-помилок немає</p>
            : jsErrors.map((e) => (
                <div key={e.id} className="js-error-row" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                  <div className="js-error-main">
                    <code className="js-error-msg">{e.message}</code>
                    <span className="js-error-meta">
                      {e.url ? new URL(e.url).pathname : "—"}
                      {" · "}
                      {new Date(e.createdAt).toLocaleString("uk-UA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {expanded === e.id && e.stack && (
                    <pre className="js-error-stack">{e.stack.slice(0, 800)}</pre>
                  )}
                </div>
              ))
        }
      </Card>

      <p className="admin-section-title">Часті помилки у вправах</p>
      {sortedMistakes.length === 0
        ? <Card><p style={{ color: "var(--muted)", textAlign: "center" }}>Помилок ще немає</p></Card>
        : <Card>
            {sortedMistakes.slice(0, 30).map(([id, { correct, wrongs, count }]) => (
              <div key={id} className="admin-error-row">
                <span className="admin-error-count">{count}×</span>
                <div>
                  <strong>{correct}</strong>
                  <span> ← {[...new Set(wrongs)].slice(0, 3).join(", ")}</span>
                </div>
              </div>
            ))}
          </Card>
      }
    </main>
  );
}

// ── NOTIFY SCREEN ─────────────────────────────────────────────────────────────
type NotifyTarget = "students" | "plus" | "all" | "level";

function NotifyScreen() {
  const [title,   setTitle]   = useState("");
  const [body,    setBody]    = useState("");
  const [target,  setTarget]  = useState<NotifyTarget>("students");
  const [level,   setLevel]   = useState<UserLevel>("A1");
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState<{ sent: number } | null>(null);
  const [error,   setError]   = useState("");

  // audience count is resolved server-side at send time

  const TEMPLATES = [
    { label: "🔥 Стрік",      title: "Не забудь про стрік!",       body: "Пройди урок сьогодні, щоб зберегти свою серію 🔥" },
    { label: "📚 Нові уроки", title: "З'явились нові уроки!",       body: "Перевір що нового у твоєму рівні 👀" },
    { label: "🏆 Тиждень",    title: "Підсумки тижня",              body: "Подивись скільки XP ти заробив цього тижня 🏆" },
    { label: "⭐ Plus",        title: "Спробуй Plus безкоштовно",   body: "Отримай +50% XP та необмежені серця 💜" },
  ];

  async function send() {
    if (!title.trim() || !body.trim()) { setError("Заповни заголовок і текст"); return; }
    setSending(true); setError(""); setResult(null);
    try {
      const targetStr = target === "level" ? `level:${level}` : target;
      const res = await apiClient.broadcastPush(title.trim(), body.trim(), targetStr);
      setResult({ sent: res.sent });
      setTitle(""); setBody("");
    } catch {
      setError("Помилка відправки. Перевір налаштування FCM на сервері.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="page-content">
      <PageHeader title="Push-сповіщення" subtitle="Відправити повідомлення студентам" />

      <h3 className="admin-section-title">Шаблони</h3>
      <div className="notify-templates">
        {TEMPLATES.map((tpl) => (
          <button key={tpl.label} type="button" className="notify-template-btn"
            onClick={() => { setTitle(tpl.title); setBody(tpl.body); }}>
            {tpl.label}
          </button>
        ))}
      </div>

      <h3 className="admin-section-title">Повідомлення</h3>
      <Card className="form-stack">
        <Field label="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div>
          <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>Текст</label>
          <textarea className="notify-textarea" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Текст повідомлення…" rows={3} />
        </div>
      </Card>

      <h3 className="admin-section-title">Аудиторія</h3>
      <Card>
        <div className="notify-target-row">
          {([
            ["students", "Всі студенти"],
            ["plus",     "Plus"],
            ["all",      "Всі"],
            ["level",    "За рівнем"],
          ] as [NotifyTarget, string][]).map(([val, label]) => (
            <button key={val} type="button" className={`chip chip--sm ${target === val ? "active" : ""}`} onClick={() => setTarget(val)}>
              {label}
            </button>
          ))}
        </div>
        {target === "level" && (
          <div className="filter-row" style={{ marginTop: 10 }}>
            {LEVEL_ORDER.map((lvl) => (
              <button key={lvl} type="button" className={`chip chip--sm ${level === lvl ? "active" : ""}`} onClick={() => setLevel(lvl)}>
                {lvl}
              </button>
            ))}
          </div>
        )}
        <div className="notify-audience-info">
          <UserRound size={14} />
          <span>Кількість отримувачів визначається на сервері</span>
        </div>
      </Card>

      {(title || body) && (
        <>
          <h3 className="admin-section-title">Попередній перегляд</h3>
          <div className="notify-preview">
            <div className="notify-preview-icon">🔔</div>
            <div>
              <strong>{title || "Заголовок…"}</strong>
              <p>{body || "Текст…"}</p>
            </div>
          </div>
        </>
      )}

      {error  && <p className="field-error" style={{ marginTop: 8 }}>{error}</p>}
      {result && <div className="notify-result-banner">✅ Відправлено на {result.sent} пристроїв</div>}

      <Button onClick={send} disabled={sending || !title.trim() || !body.trim()}>
        <Send size={15} /> {sending ? "Надсилаємо…" : "Надіслати"}
      </Button>
    </main>
  );
}

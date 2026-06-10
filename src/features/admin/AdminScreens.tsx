import { useEffect, useState } from "react";
import { Route, Routes, useParams } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { Button, Card, PageHeader } from "../../components/ui";
import { apiClient } from "../../services/apiClient";
import { selectCurrentUser, useAppStore } from "../../store/useAppStore";
import { useT } from "../../i18n";
import type { UserRole } from "../../types";

export function AdminLayout() {
  return (
    <AppShell role="admin">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="users/:userId" element={<UserDetail />} />
        <Route path="lessons" element={<Lessons />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="stats" element={<Stats />} />
        <Route path="errors" element={<Errors />} />
      </Routes>
    </AppShell>
  );
}

function useAdminData() {
  const store = useAppStore();
  const user = selectCurrentUser(store.data, store.currentUserId);
  return { ...store, user };
}

function Dashboard() {
  const { data } = useAdminData();
  const { t } = useT();
  const students = data.users.filter((user) => user.role === "student");
  const attempts = Object.values(data.progress).flatMap((progress) => progress.lessonAttempts);
  const mistakes = Object.values(data.progress).flatMap((progress) => progress.mistakes);
  const plus = data.users.filter((user) => user.subscriptionStatus === "plus").length;
  return (
    <main className="page-content">
      <PageHeader title={t("admin.dashboard.title")} subtitle={t("admin.dashboard.subtitle")} />
      <div className="stats-grid">
        <Card><strong>{data.users.length}</strong><span>{t("admin.dashboard.stat_users")}</span></Card>
        <Card><strong>{students.length}</strong><span>{t("admin.dashboard.stat_students")}</span></Card>
        <Card><strong>{data.users.filter((user) => user.role === "teacher").length}</strong><span>{t("admin.dashboard.stat_teachers")}</span></Card>
        <Card><strong>{plus}</strong><span>{t("admin.dashboard.stat_plus")}</span></Card>
        <Card><strong>{attempts.length}</strong><span>{t("admin.dashboard.stat_completions")}</span></Card>
        <Card><strong>{mistakes.length}</strong><span>{t("admin.dashboard.stat_mistakes")}</span></Card>
      </div>
    </main>
  );
}

function Users() {
  const { data, adminUpdateUser } = useAdminData();
  const { t } = useT();
  return (
    <main className="page-content">
      <PageHeader title={t("admin.users.title")} />
      <Card>
        {data.users.map((user) => (
          <div className="admin-row" key={user.id}>
            <div><strong>{user.name}</strong><span>{user.email}</span></div>
            <span className="status-pill">{user.role}</span>
            <span>{user.level}</span>
            <Button variant="secondary" onClick={() => adminUpdateUser(user.id, { role: user.role === "student" ? "teacher" : "student" as UserRole })}>{t("admin.users.btn_role")}</Button>
            <Button variant={user.isBlocked ? "secondary" : "danger"} onClick={() => adminUpdateUser(user.id, { isBlocked: !user.isBlocked })}>{user.isBlocked ? t("admin.users.btn_unblock") : t("admin.users.btn_block")}</Button>
          </div>
        ))}
      </Card>
    </main>
  );
}

function UserDetail() {
  const { userId } = useParams();
  const { data } = useAdminData();
  const { t } = useT();
  const user = data.users.find((item) => item.id === userId);
  const progress = user ? data.progress[user.id] : undefined;
  return (
    <main className="page-content">
      <PageHeader title={t("admin.user_detail.title")} />
      <Card>
        <h2>{user?.name || t("admin.user_detail.not_found")}</h2>
        <p>{user?.email}</p>
        <p>{t("admin.user_detail.role")} {user?.role}</p>
        <p>{t("admin.user_detail.level")} {user?.level}</p>
        <p>{t("admin.user_detail.xp")} {progress?.xpTotal || 0}</p>
        <p>{t("admin.user_detail.completed")} {progress?.completedLessons.length || 0}</p>
      </Card>
    </main>
  );
}

function Lessons() {
  const { data } = useAdminData();
  const { t } = useT();
  return (
    <main className="page-content">
      <PageHeader title={t("admin.lessons.title")} />
      <Card>
        {data.lessons.map((lesson) => <div className="leader-row" key={lesson.id}><strong>{lesson.title}</strong><span>{lesson.level}</span><span>{lesson.isPublished ? t("admin.lessons.published") : t("admin.lessons.draft")}</span></div>)}
      </Card>
    </main>
  );
}

function Subscriptions() {
  const { data, adminUpdateUser } = useAdminData();
  const { t } = useT();
  return (
    <main className="page-content">
      <PageHeader title={t("admin.subscriptions.title")} subtitle={t("admin.subscriptions.subtitle")} />
      <Card>
        {data.users.map((user) => <div className="leader-row" key={user.id}><strong>{user.name}</strong><span>{user.subscriptionStatus}</span><Button variant="secondary" onClick={() => adminUpdateUser(user.id, { subscriptionStatus: user.subscriptionStatus === "plus" ? "trial" : "plus" })}>{t("admin.subscriptions.toggle")}</Button></div>)}
      </Card>
    </main>
  );
}

interface AdminStats {
  summary: {
    totalUsers: number;
    active24h: number;
    active7d: number;
    plusUsers: number;
    avgXP: number;
    avgStreak: number;
  };
  levels: Record<string, number>;
  dailyRegistrations: Array<{ date: string; count: number }>;
}

function Stats() {
  const { t } = useT();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getAdminStats()
      .then((res) => setStats(res))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="page-content"><PageHeader title={t("admin.stats.title")} /><p>Завантаження...</p></main>;
  if (!stats) return <main className="page-content"><PageHeader title={t("admin.stats.title")} /><p>Помилка завантаження даних</p></main>;

  const { summary, levels, dailyRegistrations } = stats;

  return (
    <main className="page-content">
      <PageHeader title={t("admin.stats.title")} />
      
      <div className="stats-grid" style={{ marginBottom: "2rem" }}>
        <Card><strong>{summary.totalUsers}</strong><span>Всього користувачів</span></Card>
        <Card><strong>{summary.active24h}</strong><span>Активні (24г)</span></Card>
        <Card><strong>{summary.active7d}</strong><span>Активні (7д)</span></Card>
        <Card><strong>{summary.plusUsers}</strong><span>Plus підписки</span></Card>
        <Card><strong>{summary.avgXP}</strong><span>Сер. XP</span></Card>
        <Card><strong>{summary.avgStreak}</strong><span>Сер. серія</span></Card>
      </div>

      <h3 style={{ marginBottom: "1rem" }}>Розподіл за рівнями</h3>
      <Card style={{ marginBottom: "2rem" }}>
        {["A0", "A1", "A2", "B1", "B2", "C1"].map((level) => (
          <div className="leader-row" key={level}>
            <strong>{level}</strong>
            <span>{levels[level] || 0} користувачів</span>
          </div>
        ))}
      </Card>

      <h3 style={{ marginBottom: "1rem" }}>Реєстрації за тиждень</h3>
      <Card>
        {dailyRegistrations.map((row) => (
          <div className="leader-row" key={row.date}>
            <strong>{row.date}</strong>
            <span>+{row.count} нових</span>
          </div>
        ))}
      </Card>
    </main>
  );
}

function Errors() {
  const { data } = useAdminData();
  const { t } = useT();
  const errors = Object.values(data.progress).flatMap((progress) => progress.mistakes);
  return (
    <main className="page-content">
      <PageHeader title={t("admin.errors.title")} />
      <Card>
        {errors.length ? errors.map((error) => <div className="leader-row" key={error.id}><strong>{error.correctAnswer}</strong><span>{error.wrongAnswer}</span></div>) : <p>{t("admin.errors.empty")}</p>}
      </Card>
    </main>
  );
}

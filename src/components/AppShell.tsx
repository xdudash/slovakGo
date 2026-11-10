import { GuideCharacter } from "./LearningCompanion";
import { BookOpen, Dumbbell, House, Medal, Settings, ShoppingBag, Trophy, UserRound, UsersRound } from "lucide-react";
import { NavLink, Outlet, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import type { UserRole } from "../types";
import { useT } from "../i18n";
import { useAppStore } from "../store/useAppStore";
import { isNativeApp } from "../services/platform";
import { LearningIcon, type LearningIconName } from './LearningIcons';

const nativeNavIcons: Record<string, LearningIconName> = {
  '/app/path': 'path', '/app/vocabulary': 'words', '/app/practice': 'practice',
  '/app/leaderboard': 'ranking', '/app/profile': 'profile',
};

const navConfig = {
  student: [
    { to: "/app/path", key: "nav.student.path", icon: House },
    { to: "/app/vocabulary", key: "nav.student.vocabulary", icon: BookOpen },
    { to: "/app/practice", key: "nav.student.practice", icon: Dumbbell },
    { to: "/app/leaderboard", key: "nav.student.leaderboard", icon: Trophy },
    { to: "/app/profile", key: "nav.student.profile", icon: UserRound }
  ],
  teacher: [
    { to: "/teacher", key: "nav.teacher.overview", icon: House },
    { to: "/teacher/lessons", key: "nav.teacher.lessons", icon: BookOpen },
    { to: "/teacher/stats", key: "nav.teacher.stats", icon: Medal },
    { to: "/teacher/import-export", key: "nav.teacher.import_export", icon: Settings }
  ],
  admin: [
    { to: "/admin", key: "nav.admin.overview", icon: House },
    { to: "/admin/users", key: "nav.admin.users", icon: UsersRound },
    { to: "/admin/lessons", key: "nav.admin.lessons", icon: BookOpen },
    { to: "/admin/subscriptions", key: "nav.admin.subscriptions", icon: ShoppingBag },
    { to: "/admin/stats", key: "nav.admin.stats", icon: Medal }
  ]
};

const adminReturnKey = "slovakgo.admin-return";

export function AppShell({ role, children }: { role: UserRole; children?: ReactNode }) {
  const { t, lang } = useT();
  const items = navConfig[role];
  const syncMessage = useAppStore((s) => s.syncMessage);
  const pendingCount = useAppStore((s) => s.data.syncQueue.length);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const data = useAppStore((s) => s.data);
  const users = data.users;
  const returnToAdmin = useAppStore((s) => s.returnToAdmin);
  const drainSync = useAppStore((s) => s.drainSync);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [adminReturnId, setAdminReturnId] = useState<string | null>(() => localStorage.getItem(adminReturnKey));
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isNativeApp) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname]);

  useEffect(() => {
    const on = () => {
      setIsOnline(true);
      drainSync().catch(() => undefined);
    };
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if (navigator.onLine) drainSync().catch(() => undefined);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [drainSync]);

  useEffect(() => {
    setAdminReturnId(localStorage.getItem(adminReturnKey));
  }, [currentUserId]);

  const currentUserName = users.find((u) => u.id === currentUserId)?.name ?? "";

  return (
    <div className={`app-frame app-frame--${role}`} data-screen={location.pathname.startsWith('/app/lesson/') ? 'lesson' : location.pathname.split('/').at(-1)}>
      {!isOnline && (
        <div className="offline-banner">
          {t("student.app.offline")}{pendingCount > 0 ? t("student.app.offline_queue").replace("{n}", String(pendingCount)) : ""}
        </div>
      )}
      <div className="app-content">
        {adminReturnId && (
          <button
            className="admin-preview-banner"
            onClick={() => { returnToAdmin(); navigate("/admin"); }}
          >
            Перегляд як <strong>{currentUserName}</strong> · лише читання — Повернутися в адмінку →
          </button>
        )}
        <main className="app-main">{children || <Outlet />}</main>
      </div>
      <nav className="bottom-nav" aria-label={t("nav.aria")}>
          <div className="nav-brand">
            <img src="/brand-avatar-v1.webp" alt="SlovakGO" className="nav-logo" width={36} height={36} /><span className="nav-wordmark">Slovak<b>GO</b></span>
          </div>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}
                end={item.to === "/teacher" || item.to === "/admin"}
                aria-label={t(item.key)}
              >
                {isNativeApp && nativeNavIcons[item.to] ? <LearningIcon name={nativeNavIcons[item.to]} /> : <Icon size={20} />}
                <span>{isNativeApp && item.to === '/app/leaderboard' ? ({ uk: 'Рейтинг', ru: 'Рейтинг', sk: 'Rebríček', en: 'Ranking' })[lang] : t(item.key)}</span>
              </NavLink>
            );
          })}
          {role === "student" && <>
            <div className="sidebar-companion"><GuideCharacter /><strong lang="sk">Zvládneš to!</strong><p>{t("student.experience.sidebar_note")}</p></div>
            <button type="button" className="sidebar-profile" onClick={() => navigate("/app/profile")} aria-label={t("nav.student.profile")}>
              <span className="sidebar-avatar">{currentUserName.slice(0, 1).toUpperCase()}</span><span className="sidebar-profile-copy"><strong>{currentUserName}</strong><small>{t("student.experience.your_profile")}</small></span>
            </button>
          </>}
      </nav>
      {syncMessage && <div className="sync-toast">{syncMessage}</div>}
    </div>
  );
}

export function NestedRoutes({ routes }: { routes: Array<{ path: string; element: ReactNode }> }) {
  return (
    <Routes>
      {routes.map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
    </Routes>
  );
}

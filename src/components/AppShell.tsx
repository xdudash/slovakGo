import { BookOpen, Dumbbell, House, Medal, Settings, ShoppingBag, Trophy, UserRound, UsersRound } from "lucide-react";
import { NavLink, Outlet, Routes, Route, useNavigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import type { UserRole } from "../types";
import { useT } from "../i18n";
import { useAppStore } from "../store/useAppStore";

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
    { to: "/admin/stats", key: "nav.admin.stats", icon: Medal },
    { to: "/app/levels", key: "Змінити свій рівень", icon: Trophy }
  ]
};

const adminReturnKey = "slovakgo.admin-return";

export function AppShell({ role, children }: { role: UserRole; children?: ReactNode }) {
  const { t } = useT();
  const items = navConfig[role];
  const syncMessage = useAppStore((s) => s.syncMessage);
  const pendingCount = useAppStore((s) => s.data.syncQueue.length);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const users = useAppStore((s) => s.data.users);
  const returnToAdmin = useAppStore((s) => s.returnToAdmin);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [adminReturnId, setAdminReturnId] = useState<string | null>(() => localStorage.getItem(adminReturnKey));
  const navigate = useNavigate();

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    setAdminReturnId(localStorage.getItem(adminReturnKey));
  }, [currentUserId]);

  const currentUserName = users.find((u) => u.id === currentUserId)?.name ?? "";

  return (
    <div className="app-frame">
      {!isOnline && (
        <div className="offline-banner">
          Офлайн{pendingCount > 0 ? ` · ${pendingCount} дій в черзі` : ""}
        </div>
      )}
      <div className="app-content">
        {adminReturnId && (
          <button
            className="admin-preview-banner"
            onClick={() => { returnToAdmin(); navigate("/admin"); }}
          >
            Перегляд як <strong>{currentUserName}</strong> — Повернутися в адмінку →
          </button>
        )}
        <main className="app-main">{children || <Outlet />}</main>
      </div>
      <nav className="bottom-nav" aria-label={t("nav.aria")}>
        <div className="nav-brand">
          <img src="/logosk.jpg" alt="SlovakGO" className="nav-logo" />
          <span>SlovakGO</span>
        </div>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`} end={item.to === "/teacher" || item.to === "/admin"}>
              <Icon size={20} />
              <span>{t(item.key)}</span>
            </NavLink>
          );
        })}
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

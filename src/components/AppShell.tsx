import { BookOpen, Dumbbell, House, Medal, Settings, ShoppingBag, Trophy, UserRound, UsersRound } from "lucide-react";
import { NavLink, Outlet, Routes, Route } from "react-router-dom";
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

export function AppShell({ role, children }: { role: UserRole; children?: ReactNode }) {
  const { t } = useT();
  const items = navConfig[role];
  const syncMessage = useAppStore((s) => s.syncMessage);
  const pendingCount = useAppStore((s) => s.data.syncQueue.length);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  return (
    <div className="app-frame">
      {!isOnline && (
        <div className="offline-banner">
          Офлайн{pendingCount > 0 ? ` · ${pendingCount} дій в черзі` : ""}
        </div>
      )}
      <main className="app-main">{children || <Outlet />}</main>
      <nav className="bottom-nav" aria-label={t("nav.aria")}>
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

import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { roleHome, selectCurrentUser, useAppStore } from "../store/useAppStore";
import { Suspense, lazy, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { UserRole } from "../types";
import "../styles/globals.css";

const AdminLayout = lazy(() => import("../features/admin/AdminScreens").then(m => ({ default: m.AdminLayout })));
const ForgotPassword = lazy(() => import("../features/auth/AuthScreens").then(m => ({ default: m.ForgotPassword })));
const GoogleDone = lazy(() => import("../features/auth/AuthScreens").then(m => ({ default: m.GoogleDone })));
const Login = lazy(() => import("../features/auth/AuthScreens").then(m => ({ default: m.Login })));
const Register = lazy(() => import("../features/auth/AuthScreens").then(m => ({ default: m.Register })));
const ResetPassword = lazy(() => import("../features/auth/AuthScreens").then(m => ({ default: m.ResetPassword })));
const Onboarding = lazy(() => import("../features/student/StudentScreens").then(m => ({ default: m.Onboarding })));
const PaymentCancel = lazy(() => import("../features/student/StudentScreens").then(m => ({ default: m.PaymentCancel })));
const PaymentSuccess = lazy(() => import("../features/student/StudentScreens").then(m => ({ default: m.PaymentSuccess })));
const PlacementTest = lazy(() => import("../features/student/StudentScreens").then(m => ({ default: m.PlacementTest })));
const StudentLayout = lazy(() => import("../features/student/StudentScreens").then(m => ({ default: m.StudentLayout })));
const TeacherLayout = lazy(() => import("../features/teacher/TeacherScreens").then(m => ({ default: m.TeacherLayout })));

function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const location = useLocation();
  const { data, currentUserId } = useAppStore();
  const user = selectCurrentUser(data, currentUserId);
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  return children;
}

function EntryRedirect() {
  const { data, currentUserId } = useAppStore();
  const user = selectCurrentUser(data, currentUserId);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "student" && !user.onboardingDone) return <Navigate to="/onboarding" replace />;
  return <Navigate to={roleHome(user.role)} replace />;
}

export function App() {
  const [restoring, setRestoring] = useState(true);
  const autoRestoreSession = useAppStore((s) => s.autoRestoreSession);

  useEffect(() => {
    autoRestoreSession().finally(() => {
      setRestoring(false);
    });
  }, [autoRestoreSession]);

  if (restoring) {
    return <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>Відновлення сесії...</div>;
  }

  return (
    <>
    <Analytics />
    <SpeedInsights />
    <Suspense fallback={<div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>Завантаження...</div>}>
      <Routes>
        <Route path="/" element={<EntryRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/google/done" element={<GoogleDone />} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/payment/cancel" element={<PaymentCancel />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/placement-test" element={<PlacementTest />} />
        <Route
          path="/app/*"
          element={
            <RequireRole roles={["student", "admin"]}>
              <StudentLayout />
            </RequireRole>
          }
        />
        <Route
          path="/teacher/*"
          element={
            <RequireRole roles={["teacher", "admin"]}>
              <TeacherLayout />
            </RequireRole>
          }
        />
        <Route
          path="/admin/*"
          element={
            <RequireRole roles={["admin"]}>
              <AdminLayout />
            </RequireRole>
          }
        />
        <Route path="*" element={<EntryRedirect />} />
      </Routes>
    </Suspense>
    </>
  );
}

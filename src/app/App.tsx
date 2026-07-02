import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { AdminLayout } from "../features/admin/AdminScreens";
import { ForgotPassword, GoogleDone, Login, Register, ResetPassword } from "../features/auth/AuthScreens";
import { Onboarding, PaymentCancel, PaymentSuccess, PlacementTest, StudentLayout } from "../features/student/StudentScreens";
import { TeacherLayout } from "../features/teacher/TeacherScreens";
import { roleHome, selectCurrentUser, useAppStore } from "../store/useAppStore";
import type { ReactNode } from "react";
import type { UserRole } from "../types";
import "../styles/globals.css";

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
  return (
    <>
    <Analytics />
    <SpeedInsights />
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
    </>
  );
}

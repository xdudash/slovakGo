import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, Field } from "../../components/ui";
import { roleHome, useAppStore } from "../../store/useAppStore";
import { apiClient } from "../../services/apiClient";
import { storageService } from "../../services/storage";
import { useT } from "../../i18n";
import type { AppData, Lesson, User, UserWord } from "../../types";

function AuthShell({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <main className="auth-screen">
      <section className="brand-panel">
        <img src="/logosk.jpg" alt="SlovakGO" className="logo-mark" />
        <h1>SlovakGO</h1>
        <p>{text}</p>
      </section>
      <Card className="auth-card">
        <h2>{title}</h2>
        {children}
      </Card>
    </main>
  );
}

export function Login() {
  const navigate = useNavigate();
  const { login, authError } = useAppStore();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    const user = await login(email, password);
    setLoading(false);
    if (user) navigate(roleHome(user.role), { replace: true });
  }

  return (
    <AuthShell title={t("auth.login_title")} text={t("auth.login_subtitle")}>
      <form onSubmit={submit} className="form-stack" noValidate>
        <Field label={t("auth.email")} type="email" value={email} autoComplete="email" autoFocus onChange={(event) => setEmail(event.target.value)} />
        <Field label={t("auth.password")} type="password" value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} />
        {authError ? <p className="error-text">{authError}</p> : null}
        <Button type="submit" disabled={loading}>{loading ? "…" : t("auth.sign_in")}</Button>
      </form>
      <div className="auth-divider"><span>або</span></div>
      <button type="button" className="btn btn-google" onClick={() => { window.location.href = "/api/auth/google/start"; }}>
        <GoogleIcon />
        Увійти через Google
      </button>
      <p className="auth-link">{t("auth.no_account")} <Link to="/register">{t("auth.register_link")}</Link></p>
      <p className="auth-link"><Link to="/forgot-password" className="auth-forgot-link">{t("auth.forgot_link")}</Link></p>
    </AuthShell>
  );
}

export function Register() {
  const navigate = useNavigate();
  const { register, authError } = useAppStore();
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const refParam = searchParams.get("ref");
  const [form, setForm] = useState({ name: "", email: "", password: "", goal: "" });
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    const user = await register(form);
    setLoading(false);
    if (user) {
      if (refParam) apiClient.claimReferral(refParam).catch(() => undefined);
      navigate("/onboarding", { replace: true });
    }
  }

  return (
    <AuthShell title={t("auth.register_title")} text={t("auth.register_subtitle")}>
      {refParam && (
        <div className="referred-banner">
          👋 {t("auth.referred_banner")}
        </div>
      )}
      <form onSubmit={submit} className="form-stack" noValidate>
        <Field label={t("auth.name")} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Field label={t("auth.email")} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <Field label={t("auth.password")} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        <Field label={t("auth.goal_label")} value={form.goal} onChange={(event) => setForm({ ...form, goal: event.target.value })} placeholder={t("auth.goal_placeholder")} />
        {authError ? <p className="error-text">{authError}</p> : null}
        <Button type="submit" disabled={loading}>{loading ? "…" : t("auth.create_account")}</Button>
      </form>
      <div className="auth-divider"><span>або</span></div>
      <button type="button" className="btn btn-google" onClick={() => { window.location.href = "/api/auth/google/start"; }}>
        <GoogleIcon />
        Зареєструватися через Google
      </button>
      <p className="auth-link">{t("auth.has_account")} <Link to="/login">{t("auth.sign_in")}</Link></p>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiClient.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch {
      setError(t("auth.forgot_error"));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthShell title={t("auth.forgot_sent_title")} text="">
        <p className="auth-info-text">{t("auth.forgot_sent_text").replace("{email}", email)}</p>
        <Link to="/login" className="btn btn-secondary">{t("auth.forgot_back")}</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("auth.forgot_title")} text={t("auth.forgot_subtitle")}>
      <form onSubmit={submit} className="form-stack" noValidate>
        <Field label={t("auth.email")} type="email" autoFocus value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        {error && <p className="error-text">{error}</p>}
        <Button type="submit" disabled={!email || loading}>{loading ? t("auth.forgot_loading") : t("auth.forgot_btn")}</Button>
      </form>
      <p className="auth-link"><Link to="/login">{t("auth.forgot_back")}</Link></p>
    </AuthShell>
  );
}

export function ResetPassword() {
  const { t } = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) return <Navigate to="/login" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) { setError(t("auth.reset_error_short")); return; }
    setLoading(true);
    setError("");
    try {
      await apiClient.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 3000);
    } catch {
      setError(t("auth.reset_error_invalid"));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthShell title={t("auth.reset_done_title")} text={t("auth.reset_done_text")}>
        <Button onClick={() => navigate("/login", { replace: true })}>{t("auth.reset_to_login")}</Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("auth.reset_title")} text={t("auth.reset_subtitle")}>
      <form onSubmit={submit} className="form-stack" noValidate>
        <Field label={t("auth.password")} type="password" autoFocus value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="error-text">{error}</p>}
        <Button type="submit" disabled={password.length < 8 || loading}>{loading ? t("auth.reset_loading") : t("auth.reset_btn")}</Button>
      </form>
    </AuthShell>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export function GoogleDone() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = searchParams.get("new") === "1";

  useEffect(() => {
    const defaults = { language: "uk" as const, notificationsEnabled: true, soundEnabled: true, hapticsEnabled: true };

    apiClient.syncPull(0).then((raw) => {
      const full = raw as { user: User; progress: AppData["progress"][string]; userWords: UserWord[]; lessons: Lesson[] };
      const userId = full.user.id;
      const { data } = useAppStore.getState();
      const users = data.users.filter((u) => u.id !== userId);

      const merged: AppData = {
        ...data,
        users: [...users, { ...full.user, settings: { ...defaults, ...full.user.settings } }],
        progress:  { ...data.progress,  [userId]: full.progress },
        userWords: { ...data.userWords, [userId]: full.userWords },
        lessons: full.lessons || data.lessons,
      };

      storageService.save(merged);
      localStorage.setItem("slovakgo.current-user", userId);
      useAppStore.setState({ data: merged, currentUserId: userId, authError: undefined });

      if (isNew || !full.user.onboardingDone) {
        navigate("/onboarding", { replace: true });
      } else {
        navigate(roleHome(full.user.role), { replace: true });
      }
    }).catch(() => {
      navigate("/login?error=google_failed", { replace: true });
    });
  }, []);

  return (
    <main className="auth-screen">
      <section className="brand-panel">
        <img src="/logosk.jpg" alt="SlovakGO" className="logo-mark" />
        <h1>SlovakGO</h1>
      </section>
      <p style={{ textAlign: "center", color: "var(--muted)", fontWeight: 600 }}>Завантаження…</p>
    </main>
  );
}

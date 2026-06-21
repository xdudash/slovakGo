import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { Button, Card, Field } from "../../components/ui";
import { roleHome, useAppStore } from "../../store/useAppStore";
import { apiClient } from "../../services/apiClient";
import { useT } from "../../i18n";

function AuthShell({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <main className="auth-screen">
      <section className="brand-panel">
        <div className="logo-mark"><GraduationCap size={34} /></div>
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

  function submit(event: FormEvent) {
    event.preventDefault();
    const user = register(form);
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
        <Button type="submit">{t("auth.create_account")}</Button>
      </form>
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

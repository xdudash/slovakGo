import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { Button, Card, Field } from "../../components/ui";
import { roleHome, useAppStore } from "../../store/useAppStore";
import { useT } from "../../i18n";

function AuthShell({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <main className="auth-screen">
      <section className="brand-panel">
        <div className="logo-mark"><GraduationCap size={34} /></div>
        <h1>Slovak Life</h1>
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
  const [email, setEmail] = useState("student@slovaklife.local");
  const [password, setPassword] = useState("password123");

  function submit(event: FormEvent) {
    event.preventDefault();
    const user = login(email, password);
    if (user) navigate(roleHome(user.role), { replace: true });
  }

  return (
    <AuthShell title={t("auth.login_title")} text={t("auth.login_subtitle")}>
      <form onSubmit={submit} className="form-stack" noValidate>
        <Field label={t("auth.email")} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Field label={t("auth.password")} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {authError ? <p className="error-text">{authError}</p> : null}
        <Button type="submit">{t("auth.sign_in")}</Button>
      </form>
      <div className="test-accounts">
        <button type="button" onClick={() => setEmail("student@slovaklife.local")}>student</button>
        <button type="button" onClick={() => setEmail("teacher@slovaklife.local")}>teacher</button>
        <button type="button" onClick={() => setEmail("admin@slovaklife.local")}>admin</button>
      </div>
      <p className="auth-link">{t("auth.no_account")} <Link to="/register">{t("auth.register_link")}</Link></p>
    </AuthShell>
  );
}

export function Register() {
  const navigate = useNavigate();
  const { register, authError } = useAppStore();
  const { t } = useT();
  const [form, setForm] = useState({ name: "", email: "", password: "", goal: "" });

  function submit(event: FormEvent) {
    event.preventDefault();
    const user = register(form);
    if (user) navigate("/onboarding", { replace: true });
  }

  return (
    <AuthShell title={t("auth.register_title")} text={t("auth.register_subtitle")}>
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

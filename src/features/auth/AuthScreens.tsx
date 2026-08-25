import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, Field } from "../../components/ui";
import { roleHome, useAppStore } from "../../store/useAppStore";
import { apiClient } from "../../services/apiClient";
import { track } from "../../services/analytics";
import { storageService } from "../../services/storage";
import { setGuestLanguage, useT } from "../../i18n";
import type { AppData, Lesson, User, UserWord } from "../../types";

function postAuthRoute(user: User): string {
  if (user.role === "student" && !user.onboardingDone) {
    return "/onboarding";
  }
  return roleHome(user.role);
}

function AuthShell({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  const { lang } = useT();
  const langOptions = [
    { code: "uk", label: "UA" },
    { code: "ru", label: "RU" },
    { code: "sk", label: "SK" },
    { code: "en", label: "EN" },
  ] as const;

  return (
    <main className="auth-screen">
      <section className="brand-panel">
        <img src="/apple-icon.png" alt="SlovakGO" className="logo-mark" />
        <h1>SlovakGO</h1>
        <p>{text}</p>
      </section>
      <Card className="auth-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            {langOptions.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => setGuestLanguage(opt.code)}
                style={{
                  padding: "0.2rem 0.5rem",
                  fontSize: "0.75rem",
                  fontWeight: lang === opt.code ? "bold" : "normal",
                  borderRadius: "6px",
                  border: lang === opt.code ? "1px solid var(--color-primary, #2563eb)" : "1px solid var(--color-border, #e5e7eb)",
                  background: lang === opt.code ? "var(--color-primary-light, #eff6ff)" : "transparent",
                  color: lang === opt.code ? "var(--color-primary, #2563eb)" : "inherit",
                  cursor: "pointer"
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {children}
      </Card>
    </main>
  );
}

export function Login() {
  const navigate = useNavigate();
  const { login, loginAsUser, resetLocal, currentUserId, authError } = useAppStore();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUserId) {
      const { data } = useAppStore.getState();
      const user = data.users.find((u) => u.id === currentUserId);
      if (user) {
        navigate(postAuthRoute(user), { replace: true });
      }
    }
  }, [currentUserId, navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user) navigate(postAuthRoute(user), { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title={t("auth.login_title")} text={t("auth.login_subtitle")}>
      {import.meta.env.DEV && (
        <Button
          type="button"
          onClick={() => {
            resetLocal();
            loginAsUser("user-student");
            window.location.assign(`${import.meta.env.BASE_URL}app/lesson/lesson-1-a0`);
          }}
        >
          Открыть первый урок
        </Button>
      )}
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
  const { register, currentUserId, authError } = useAppStore();
  const { t, lang } = useT();
  const [searchParams] = useSearchParams();
  const refParam = searchParams.get("ref");
  const demoDoneParam = searchParams.get("demoDone") === "true";
  const isRu = lang === "ru";

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUserId) return;
    const { data } = useAppStore.getState();
    const user = data.users.find((item) => item.id === currentUserId);
    if (user) navigate(postAuthRoute(user), { replace: true });
  }, [currentUserId, navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const defaultName = form.email.split("@")[0] || "Студент";
      const user = await register({
        name: defaultName,
        email: form.email,
        password: form.password,
      });

      if (user) {
        useAppStore.getState().updateUser({ settings: { ...user.settings, language: lang } });
        const savedDemoXp = localStorage.getItem("slovakgo.demo-xp");
        if (savedDemoXp) {
          const addXp = parseInt(savedDemoXp, 10) || 50;
          const { data } = useAppStore.getState();
          const progress = data.progress[user.id];
          if (progress) {
            useAppStore.setState((state) => ({
              data: {
                ...state.data,
                progress: {
                  ...state.data.progress,
                  [user.id]: {
                    ...progress,
                    xpTotal: progress.xpTotal + addXp,
                    xpWeekly: progress.xpWeekly + addXp,
                    streakDays: Math.max(progress.streakDays, 1),
                  },
                },
              },
            }));
          }
          localStorage.removeItem("slovakgo.demo-xp");
          localStorage.removeItem("slovakgo.demo-streak");
        }

        if (refParam) apiClient.claimReferral(refParam).catch(() => undefined);
        track("register", { referred: Boolean(refParam) });
        navigate("/onboarding", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={isRu ? "Сохранить прогресс" : t("auth.register_title")}
      text={isRu ? "Создайте профиль за 10 секунд, чтобы сохранить 50 XP и продолжить." : "Створи профіль за 10 секунд, щоб зберегти свій результат."}
    >
      {demoDoneParam && (
        <div className="referred-banner" style={{ background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46" }}>
          🎉 {isRu ? "Демо-урок пройден (+50 XP)! Введите email и пароль, чтобы сохранить результат." : "Демо-урок пройдено (+50 XP)! Введи email та пароль, щоб зберегти свій результат."}
        </div>
      )}
      {refParam && (
        <div className="referred-banner">
          👋 {t("auth.referred_banner")}
        </div>
      )}
      <form onSubmit={submit} className="form-stack" noValidate>
        <Field label={t("auth.email")} type="email" value={form.email} autoFocus onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <Field label={t("auth.password")} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        {authError ? <p className="error-text">{authError}</p> : null}
        <Button type="submit" disabled={loading} loading={loading}>
          {loading
            ? (isRu ? "Создаем аккаунт…" : "Створюємо акаунт…")
            : (demoDoneParam
                ? (isRu ? "Сохранить прогресс и продолжить" : "Зберегти прогрес та продовжити")
                : t("auth.create_account")
              )
          }
        </Button>
      </form>
      <div className="auth-divider"><span>{isRu ? "или" : "або"}</span></div>
      <button type="button" className="btn btn-google" onClick={() => { window.location.href = "/api/auth/google/start"; }}>
        <GoogleIcon />
        {isRu ? "Войти через Google" : "Зареєструватися через Google"}
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

    apiClient.syncPull(0, false).then((raw) => {
      const full = raw as { user: User; progress: AppData["progress"][string]; userWords: UserWord[]; lessons?: Lesson[] };
      const userId = full.user.id;
      const { data } = useAppStore.getState();
      const users = data.users.filter((u) => u.id !== userId);

      const merged: AppData = {
        ...data,
        users: [...users, { ...full.user, settings: { ...defaults, ...full.user.settings } }],
        progress:  { ...data.progress,  [userId]: full.progress },
        userWords: { ...data.userWords, [userId]: full.userWords },
        lessons: full.lessons?.length ? full.lessons : data.lessons,
      };

      storageService.save(merged);
      localStorage.setItem("slovakgo.current-user", userId);
      useAppStore.setState({ data: merged, currentUserId: userId, authError: undefined });
      useAppStore.getState().refreshLessons().catch(() => undefined);

      if (isNew) {
        navigate("/onboarding", { replace: true });
      } else if (!full.user.onboardingDone) {
        navigate("/onboarding", { replace: true });
      } else {
        navigate(roleHome(full.user.role), { replace: true });
      }
    }).catch(() => {
      navigate("/login?error=google_failed", { replace: true });
    });
  }, [isNew, navigate]);

  return (
    <main className="auth-screen">
      <section className="brand-panel">
        <img src="/apple-icon.png" alt="SlovakGO" className="logo-mark" />
        <h1>SlovakGO</h1>
      </section>
      <p style={{ textAlign: "center", color: "var(--muted)", fontWeight: 600 }}>Завантаження…</p>
    </main>
  );
}

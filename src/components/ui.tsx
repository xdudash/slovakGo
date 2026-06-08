import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

export function Button({
  children,
  variant = "primary",
  loading,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean }) {
  return (
    <button className={`btn btn-${variant} ${className}`} disabled={props.disabled || loading} {...props}>
      {loading ? <Loader2 size={18} className="spin" /> : null}
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Field({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
      {error ? <small className="error-text">{error}</small> : null}
    </label>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <Card className="empty">
      <strong>{title}</strong>
      <p>{text}</p>
    </Card>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal={true} onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>,
    document.body
  );
}

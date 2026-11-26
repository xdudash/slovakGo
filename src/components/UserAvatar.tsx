import type { CSSProperties } from "react";
import { API_BASE_URL } from "../services/apiClient";

/** Photo (data URL, http URL or API path), else initials, inside an optional frame ring. */
export function UserAvatar({ name, avatar, photo, frame, size = 40, className = "" }: {
  name: string;
  avatar?: string | null;
  /** Leaderboard photo path relative to the API base. */
  photo?: string | null;
  frame?: string | null;
  size?: number;
  className?: string;
}) {
  const src = photo ? `${API_BASE_URL}${photo}`
    : avatar && (avatar.startsWith("data:") || avatar.startsWith("http")) ? avatar
    : null;
  const initials = (avatar && !src ? avatar : name).slice(0, 2).toUpperCase();
  const style = { "--ua-size": `${size}px` } as CSSProperties;
  return (
    <span className={`user-avatar${frame && frame !== "simple" ? ` user-avatar--${frame}` : ""} ${className}`.trim()} style={style}>
      {src
        ? <img className="user-avatar-img" src={src} alt="" loading="lazy" decoding="async" />
        : <span className="user-avatar-initials" aria-hidden="true">{initials}</span>}
    </span>
  );
}

/** The crown used for the in-app currency. */
export function CrownIcon({ size = 16 }: { size?: number }) {
  return (
    <svg className="crown-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 8.5 7.5 12 12 5l4.5 7L21 8.5 19.2 18H4.8L3 8.5Z" fill="#FFD21F" stroke="#E0A800" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="4.8" y="18.4" width="14.4" height="2.2" rx="1.1" fill="#E0A800" />
    </svg>
  );
}

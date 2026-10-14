import type { ReactNode } from "react";
/** SlovakGO's original speech-bubble character, shared across learning moments. */
export function GuideCharacter({
  className = "",
  mood = "happy",
}: {
  className?: string;
  mood?: "happy" | "thinking" | "celebrate";
}) {
  return (
    <svg
      className={`guide-character ${className}`}
      viewBox="0 0 160 160"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="80" cy="146" rx="43" ry="6" fill="#211946" opacity=".07" />
      <path
        d="M48 115l-13 24M110 115l14 23"
        stroke="#211946"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d={
          mood === "celebrate"
            ? "M31 70L15 45M129 68l17-27"
            : "M31 77L16 68M128 71l16-17"
        }
        stroke="#211946"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M31 39q0-19 19-19h60q19 0 19 19v59q0 19-19 19H86l-23 18v-18H50q-19 0-19-19z"
        fill="#6f57e8"
      />
      <path
        d="M47 36q0-5 5-5h20"
        stroke="#a99af5"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {mood === "celebrate" ? (
        <path
          d="M56 64q5-8 10 0M96 64q5-8 10 0"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
        />
      ) : (
        <>
          <rect x="58" y="58" width="7" height="14" rx="3.5" fill="white" />
          <rect x="96" y="58" width="7" height="14" rx="3.5" fill="white" />
        </>
      )}
      <path
        d={mood === "thinking" ? "M72 88h16" : "M69 85q12 13 24 0"}
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M134 10l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill="#ffd21f" />
      {mood === "celebrate" && (
        <path d="M17 97l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#ffd21f" />
      )}
    </svg>
  );
}

export function CompanionNote({
  title,
  text,
  children,
  mood = "happy",
  className = "",
}: {
  title: string;
  text?: string;
  children?: ReactNode;
  mood?: "happy" | "thinking" | "celebrate";
  className?: string;
}) {
  return (
    <div className={`companion-note ${className}`}>
      <GuideCharacter mood={mood} />
      <div className="companion-note-copy">
        <strong>{title}</strong>
        {text && <p>{text}</p>}
        {children}
      </div>
    </div>
  );
}

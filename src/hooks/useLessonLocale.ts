import { isNativeApp, PUBLIC_APP_ORIGIN } from "../services/platform";
import { useCallback } from "react";
import { useT } from "../i18n";
import type { Lesson, LocalizedText } from "../types";
import { resolveAsset, resolveText } from "../utils/lessonLocale";

/**
 * Per-lesson localization helper for student-facing exercise components.
 * `tx` resolves any lesson-content text field for the current user language,
 * falling back to the lesson's own `localization.fallbackUiLanguage` (else "uk").
 * `asset` resolves an `imageRef`/`audioRef` against `lesson.assets`.
 */
export function useLessonLocale(lesson: Lesson | undefined) {
  const { lang } = useT();
  const fallbackLang = lesson?.localization?.fallbackUiLanguage ?? "uk";

  const tx = useCallback(
    (value: LocalizedText | undefined) => resolveText(value, lang, fallbackLang),
    [lang, fallbackLang]
  );

  const asset = useCallback(
    (ref: string | undefined, kind: "images" | "audio") => {
      const found = resolveAsset(lesson, ref, kind, lang, fallbackLang);
      // Lessons change on the server; a relative file may not exist in the installed app.
      return found && isNativeApp && found.src.startsWith("/") ? { ...found, src: `${PUBLIC_APP_ORIGIN}${found.src}` } : found;
    },
    [lesson, lang, fallbackLang]
  );

  return { lang, tx, asset };
}

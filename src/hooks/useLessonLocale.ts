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
    (ref: string | undefined, kind: "images" | "audio") =>
      resolveAsset(lesson, ref, kind, lang, fallbackLang),
    [lesson, lang, fallbackLang]
  );

  return { lang, tx, asset };
}

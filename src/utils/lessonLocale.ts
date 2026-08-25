import type { Lesson, LessonAudioAsset, LessonImageAsset, Locale, LocalizedText } from "../types";

/**
 * Resolves a lesson-content text field for a given UI language.
 * Plain strings (legacy lessons) pass through unchanged. Locale maps
 * (new multilingual lessons) resolve `lang` -> `fallbackLang` -> first
 * available value -> "".
 */
export function resolveText(
  value: LocalizedText | undefined,
  lang: Locale,
  fallbackLang: Locale = "uk"
): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (value[lang]) return value[lang]!;
  if (value[fallbackLang]) return value[fallbackLang]!;
  const first = Object.values(value).find((v) => typeof v === "string" && v !== "");
  return first ?? "";
}

export function resolveTextArray(
  values: LocalizedText[] | undefined,
  lang: Locale,
  fallbackLang: Locale = "uk"
): string[] {
  if (!values) return [];
  return values.map((v) => resolveText(v, lang, fallbackLang));
}

/**
 * Locale-agnostic best-effort text extraction for internal (admin/teacher)
 * screens that don't have a per-user language to resolve against.
 */
export function toPlainText(value: LocalizedText | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value.uk ?? value.en ?? value.sk ?? value.ru ?? Object.values(value).find((v) => !!v) ?? "";
}

export function resolveAsset(
  lesson: Lesson | undefined,
  ref: string | undefined,
  kind: "images" | "audio",
  lang: Locale,
  fallbackLang: Locale = "uk"
): { src: string; alt?: string; transcript?: string } | undefined {
  if (!lesson || !ref) return undefined;
  const entry = lesson.assets?.[kind]?.[ref] as LessonImageAsset | LessonAudioAsset | undefined;
  if (!entry) return undefined;
  if (kind === "images") {
    const img = entry as LessonImageAsset;
    return { src: img.src, alt: resolveText(img.alt, lang, fallbackLang) };
  }
  const audio = entry as LessonAudioAsset;
  return { src: audio.src, transcript: audio.transcript };
}

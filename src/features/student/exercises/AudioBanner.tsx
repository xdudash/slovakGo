import { useT } from "../../../i18n";
import { Volume2 } from "lucide-react";
import type { Lesson } from "../../../types";
import { useLessonLocale } from "../../../hooks/useLessonLocale";
import { useAudioPlayer } from "../../../hooks/useAudioPlayer";

interface Props {
  lesson: Lesson;
  audioRef?: string;
  soundEnabled: boolean;
}

/** Shared "listen" trigger for any exercise carrying an `audioRef`. */
export function AudioBanner({ lesson, audioRef, soundEnabled }: Props) {
  const { t } = useT();
  const { asset } = useLessonLocale(lesson);
  const { play, playingSrc } = useAudioPlayer(soundEnabled);
  const resolved = asset(audioRef, "audio");
  if (!resolved) return null;

  const isPlaying = playingSrc === resolved.src;

  return (
    <button type="button" className={`audio-banner${isPlaying ? " playing" : ""}`} onClick={() => play(resolved.src)}>
      <Volume2 size={20} aria-hidden="true" />
      <span>{isPlaying ? t("student.app.playing") : t("student.app.listen")}</span>
      <span className="audio-bars" aria-hidden="true"><i /><i /><i /><i /></span>
    </button>
  );
}

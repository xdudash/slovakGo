import { useCallback, useRef, useState } from "react";

/** Single-track imperative audio player, mirroring the vocabulary screen's `playWord()` pattern. */
export function useAudioPlayer(enabled: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingSrc, setPlayingSrc] = useState<string | null>(null);

  const play = useCallback((src: string) => {
    if (!enabled || !src) return;
    audioRef.current?.pause();
    const audio = new Audio(src);
    audioRef.current = audio;
    setPlayingSrc(src);
    audio.play().catch(() => setPlayingSrc(null));
    audio.onended = () => setPlayingSrc(null);
  }, [enabled]);

  return { play, playingSrc };
}

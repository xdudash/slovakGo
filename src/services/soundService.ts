export type SoundCue = "correct" | "wrong" | "complete";

type Tone = { frequency: number; delay: number; duration: number; gain: number };

const cues: Record<SoundCue, Tone[]> = {
  correct: [
    { frequency: 523.25, delay: 0, duration: 0.08, gain: 0.035 },
    { frequency: 659.25, delay: 0.07, duration: 0.12, gain: 0.03 },
  ],
  wrong: [
    { frequency: 220, delay: 0, duration: 0.1, gain: 0.025 },
    { frequency: 196, delay: 0.08, duration: 0.12, gain: 0.02 },
  ],
  complete: [
    { frequency: 523.25, delay: 0, duration: 0.1, gain: 0.035 },
    { frequency: 659.25, delay: 0.09, duration: 0.1, gain: 0.035 },
    { frequency: 783.99, delay: 0.18, duration: 0.18, gain: 0.03 },
  ],
};

let context: AudioContext | undefined;

function audioContext(): AudioContext | undefined {
  if (typeof window === "undefined" || !window.AudioContext) return undefined;
  context ??= new window.AudioContext();
  return context;
}

export const soundService = {
  play(cue: SoundCue, enabled = true): void {
    if (!enabled) return;
    const ctx = audioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();

    const start = ctx.currentTime;
    for (const tone of cues[cue]) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const toneStart = start + tone.delay;
      const toneEnd = toneStart + tone.duration;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(tone.frequency, toneStart);
      gain.gain.setValueAtTime(0.0001, toneStart);
      gain.gain.exponentialRampToValueAtTime(tone.gain, toneStart + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(toneStart);
      oscillator.stop(toneEnd + 0.01);
    }
  },
};

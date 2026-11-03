import { isNativeApp } from './platform';
import type { SoundCue } from './soundService';

export function playHaptic(cue: SoundCue, enabled: boolean): void {
  if (!isNativeApp || !enabled) return;
  void import('@capacitor/haptics').then(({ Haptics, NotificationType, ImpactStyle }) =>
    cue === 'correct' ? Haptics.impact({ style: ImpactStyle.Light })
      : Haptics.notification({ type: cue === 'wrong' ? NotificationType.Warning : NotificationType.Success })
  ).catch(() => undefined);
}

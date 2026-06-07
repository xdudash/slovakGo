import { describe, expect, it } from 'vitest';
import { currentWeekId, formatWeekTimer, secondsUntilWeekEnd } from './date';

// All tests pass an explicit `now` — no reliance on system clock.
// TZ=UTC is set in the npm test script.

describe('currentWeekId', () => {
  it('returns Monday date for Monday itself', () => {
    expect(currentWeekId(new Date('2026-06-01T12:00:00Z'))).toBe('2026-06-01');
  });

  it('returns Monday date for Wednesday mid-week', () => {
    expect(currentWeekId(new Date('2026-06-03T12:00:00Z'))).toBe('2026-06-01');
  });

  it('returns Monday date for Sunday (last day of week)', () => {
    expect(currentWeekId(new Date('2026-06-07T12:00:00Z'))).toBe('2026-06-01');
  });

  it('rolls to next week on the following Monday', () => {
    expect(currentWeekId(new Date('2026-06-08T12:00:00Z'))).toBe('2026-06-08');
  });

  it('handles month boundary correctly', () => {
    // Friday May 29 → Monday of that week is May 25
    expect(currentWeekId(new Date('2026-05-29T12:00:00Z'))).toBe('2026-05-25');
  });

  it('returns the same weekId for every day in the same week', () => {
    const days = ['01', '02', '03', '04', '05', '06', '07'].map(
      (d) => currentWeekId(new Date(`2026-06-${d}T12:00:00Z`))
    );
    expect(new Set(days).size).toBe(1);
  });
});

describe('secondsUntilWeekEnd', () => {
  it('returns 0 at the very end of Sunday', () => {
    expect(secondsUntilWeekEnd(new Date('2026-06-07T23:59:59.999Z'))).toBe(0);
  });

  it('returns positive value on Monday morning', () => {
    expect(secondsUntilWeekEnd(new Date('2026-06-01T06:00:00Z'))).toBeGreaterThan(0);
  });

  it('is larger earlier in the week', () => {
    const monday = secondsUntilWeekEnd(new Date('2026-06-01T12:00:00Z'));
    const friday = secondsUntilWeekEnd(new Date('2026-06-05T12:00:00Z'));
    expect(monday).toBeGreaterThan(friday);
  });

  it('does not exceed 7 days worth of seconds', () => {
    const monday = secondsUntilWeekEnd(new Date('2026-06-01T00:00:00Z'));
    expect(monday).toBeLessThanOrEqual(7 * 86400);
  });
});

describe('formatWeekTimer', () => {
  it('formats zero seconds', () => {
    expect(formatWeekTimer(0)).toBe('0 д 0 год 0 хв');
  });

  it('formats exactly 1 day 2 hours 3 minutes', () => {
    expect(formatWeekTimer(86400 + 7200 + 180)).toBe('1 д 2 год 3 хв');
  });

  it('rounds down sub-minute seconds', () => {
    expect(formatWeekTimer(90)).toBe('0 д 0 год 1 хв');
  });

  it('formats a full 6 days 23 hours 59 minutes', () => {
    const s = 6 * 86400 + 23 * 3600 + 59 * 60;
    expect(formatWeekTimer(s)).toBe('6 д 23 год 59 хв');
  });
});

import { describe, expect, it } from 'vitest';
import { nativePushPayload } from '../../api/_lib/nativePush';

describe('APNs payload boundary', () => {
  it('uses an alert payload and a fixed internal route', () => {
    expect(JSON.parse(nativePushPayload('Study', 'Continue your lesson'))).toEqual({
      aps: { alert: { title: 'Study', body: 'Continue your lesson' }, sound: 'default' }, route: '/app/path',
    });
  });
  it('enforces the UTF-8 byte limit, including multibyte text', () => {
    expect(() => nativePushPayload('SlovakGO', '🙂'.repeat(1100))).toThrow('4096-byte');
  });
});

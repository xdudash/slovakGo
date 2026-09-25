import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./idbQueue', () => ({
  idbGetAll: vi.fn(),
  idbPut: vi.fn().mockResolvedValue(undefined),
  idbDelete: vi.fn().mockResolvedValue(undefined),
}));

import { idbDelete, idbGetAll } from './idbQueue';
import { syncService } from './syncService';
import type { SyncMutation } from '../types';

function makeMutation(id: string, userId = 'user-a'): SyncMutation {
  return { id, userId, type: 'test.action', payload: {}, createdAt: '2026-06-07T10:00:00Z' };
}

describe('syncService.recover', () => {
  beforeEach(() => {
    vi.mocked(idbGetAll).mockReset();
    vi.mocked(idbDelete).mockClear();
  });

  it('returns only orphaned mutations belonging to the current user', async () => {
    const own = makeMutation('own');
    const other = makeMutation('other', 'user-b');
    vi.mocked(idbGetAll).mockResolvedValue([own, other]);
    expect(await syncService.recover([], 'user-a')).toEqual([own]);
  });

  it('excludes mutations already in currentQueue', async () => {
    const m1 = makeMutation('id-1');
    const m2 = makeMutation('id-2');
    vi.mocked(idbGetAll).mockResolvedValue([m1, m2]);
    expect(await syncService.recover([m1], 'user-a')).toEqual([m2]);
  });

  it('deletes legacy ownerless IDB mutations instead of replaying them', async () => {
    const legacy = { id: 'legacy', type: 'test.action', payload: {}, createdAt: '2026-06-07T10:00:00Z' } as SyncMutation;
    vi.mocked(idbGetAll).mockResolvedValue([legacy]);
    expect(await syncService.recover([], 'user-a')).toEqual([]);
    expect(idbDelete).toHaveBeenCalledWith('legacy');
  });

  it('handles IDB errors gracefully', async () => {
    vi.mocked(idbGetAll).mockRejectedValue(new Error('IDB unavailable'));
    expect(await syncService.recover([], 'user-a')).toEqual([]);
  });
});

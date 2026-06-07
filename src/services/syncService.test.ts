import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./idbQueue', () => ({
  idbGetAll: vi.fn(),
  idbPut: vi.fn().mockResolvedValue(undefined),
  idbDelete: vi.fn().mockResolvedValue(undefined),
}));

// Imports must come AFTER vi.mock (hoisted automatically by Vitest)
import { idbGetAll } from './idbQueue';
import { syncService } from './syncService';
import type { SyncMutation } from '../types';

function makeMutation(id: string): SyncMutation {
  return { id, type: 'test.action', payload: {}, createdAt: '2026-06-07T10:00:00Z' };
}

// ─── recover ──────────────────────────────────────────────────────────────────

describe('syncService.recover', () => {
  beforeEach(() => {
    vi.mocked(idbGetAll).mockReset();
  });

  it('returns empty array when IDB is empty', async () => {
    vi.mocked(idbGetAll).mockResolvedValue([]);
    expect(await syncService.recover([])).toEqual([]);
  });

  it('returns all IDB mutations when currentQueue is empty', async () => {
    const m1 = makeMutation('id-1');
    const m2 = makeMutation('id-2');
    vi.mocked(idbGetAll).mockResolvedValue([m1, m2]);
    const result = await syncService.recover([]);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(m1);
    expect(result).toContainEqual(m2);
  });

  it('excludes mutations already in currentQueue', async () => {
    const m1 = makeMutation('id-1');
    const m2 = makeMutation('id-2');
    vi.mocked(idbGetAll).mockResolvedValue([m1, m2]);
    const result = await syncService.recover([m1]); // m1 already in queue
    expect(result).toEqual([m2]);
  });

  it('returns empty array when all IDB mutations are in currentQueue', async () => {
    const m1 = makeMutation('id-1');
    vi.mocked(idbGetAll).mockResolvedValue([m1]);
    expect(await syncService.recover([m1])).toEqual([]);
  });

  it('deduplicates by id, not by reference equality', async () => {
    const m1 = makeMutation('id-1');
    const m1Copy = { ...m1, payload: { extra: true } }; // same id, different object
    vi.mocked(idbGetAll).mockResolvedValue([m1]);
    const result = await syncService.recover([m1Copy]); // same id in queue
    expect(result).toEqual([]);
  });

  it('handles IDB errors gracefully and returns empty array', async () => {
    vi.mocked(idbGetAll).mockRejectedValue(new Error('IDB unavailable'));
    expect(await syncService.recover([])).toEqual([]);
  });

  it('handles multiple orphaned mutations preserving order', async () => {
    const mutations = ['a', 'b', 'c', 'd'].map(makeMutation);
    vi.mocked(idbGetAll).mockResolvedValue(mutations);
    const result = await syncService.recover([mutations[1], mutations[3]]); // b and d in queue
    expect(result.map((m) => m.id)).toEqual(['a', 'c']);
  });
});

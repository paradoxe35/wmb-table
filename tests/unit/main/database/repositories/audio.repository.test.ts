import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as audioRepo from '@main/database/repositories/audio.repository';

describe('audio.repository', () => {
  beforeEach(() => {
    createTestDb();
  });

  it('getTimeByAudioLink returns null for unknown link', () => {
    expect(audioRepo.getTimeByAudioLink('unknown')).toBeNull();
  });

  it('setTime upserts by audioLink', () => {
    audioRepo.setTime('link1', 100);
    expect(audioRepo.getTimeByAudioLink('link1')?.time).toBe(100);

    audioRepo.setTime('link1', 200);
    expect(audioRepo.getTimeByAudioLink('link1')?.time).toBe(200);
  });

  it('getDownloadByAudioLink returns null for unknown', () => {
    expect(audioRepo.getDownloadByAudioLink('unknown')).toBeNull();
  });

  it('last play single-row', () => {
    expect(audioRepo.getLastPlay()).toBeNull();

    const doc = JSON.stringify({ title: 'Test Doc' });
    audioRepo.setLastPlay(doc);
    expect(audioRepo.getLastPlay()).toBe(doc);

    const doc2 = JSON.stringify({ title: 'Another Doc' });
    audioRepo.setLastPlay(doc2);
    expect(audioRepo.getLastPlay()).toBe(doc2);
  });
});

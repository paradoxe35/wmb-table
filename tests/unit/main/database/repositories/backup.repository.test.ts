import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as backupRepo from '@main/database/repositories/backup.repository';

describe('backup.repository', () => {
  beforeEach(() => {
    createTestDb();
  });

  it('getStatus returns null initially', () => {
    expect(backupRepo.getStatus()).toBeNull();
  });

  it('upsertStatus creates backup status', () => {
    const status = backupRepo.upsertStatus({
      email: 'test@example.com',
      name: 'Test User',
      active: true,
      access: true,
      restored: false,
      lastUpdate: new Date(),
    });
    expect(status.email).toBe('test@example.com');
    expect(status.active).toBe(true);
  });

  it('toggleStatus changes active flag', () => {
    backupRepo.upsertStatus({
      email: 'test@example.com',
      name: 'Test',
      active: true,
      access: true,
      restored: false,
      lastUpdate: new Date(),
    });

    backupRepo.toggleStatus(false);
    expect(backupRepo.getStatus()?.active).toBe(false);
  });

  it('getReminder returns false when no status', () => {
    expect(backupRepo.getReminder()).toBe(false);
  });

  it('db references CRUD', () => {
    const ref = backupRepo.upsertDbReference('file.db', 'line1\nline2');
    expect(ref.filename).toBe('file.db');

    expect(backupRepo.getDbReferences()).toHaveLength(1);

    backupRepo.deleteDbReference(ref.id);
    expect(backupRepo.getDbReferences()).toHaveLength(0);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as sidebarRepo from '@main/database/repositories/sidebar.repository';

describe('sidebar.repository', () => {
  beforeEach(() => {
    createTestDb();
  });

  it('getSidebarStatus returns null initially', () => {
    expect(sidebarRepo.getSidebarStatus()).toBeNull();
  });

  it('setSidebarStatus creates and updates', () => {
    sidebarRepo.setSidebarStatus(true);
    expect(sidebarRepo.getSidebarStatus()?.hidden).toBe(true);

    sidebarRepo.setSidebarStatus(false);
    expect(sidebarRepo.getSidebarStatus()?.hidden).toBe(false);
  });
});

/**
 * Tests for AWCP MCP Server tools
 */

import { describe, it, expect } from 'vitest';
import { delegateSchema, type DelegateParams } from '../src/tools/delegate.js';
import { delegateOutputSchema, type DelegateOutputParams } from '../src/tools/delegate-output.js';
import { delegateCancelSchema, type DelegateCancelParams } from '../src/tools/delegate-cancel.js';
import { delegateSnapshotsSchema, type DelegateSnapshotsParams } from '../src/tools/delegate-snapshots.js';
import { delegateApplySnapshotSchema, type DelegateApplySnapshotParams } from '../src/tools/delegate-apply-snapshot.js';
import { delegateDiscardSnapshotSchema, type DelegateDiscardSnapshotParams } from '../src/tools/delegate-discard-snapshot.js';
import { delegateRecoverSchema, type DelegateRecoverParams } from '../src/tools/delegate-recover.js';

describe('delegate tool schema', () => {
  it('should validate valid delegate params with workspace_dir', () => {
    const params: DelegateParams = {
      description: 'Fix TypeScript errors',
      prompt: 'Find and fix all type errors in src/',
      workspace_dir: '/path/to/project',
      peer_url: 'http://executor:4001/awcp',
    };

    const result = delegateSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should validate delegate params with all options', () => {
    const params: DelegateParams = {
      description: 'Fix bug',
      prompt: 'Fix the bug in auth module',
      workspace_dir: '/projects/myapp',
      peer_url: 'http://localhost:4001/awcp',
      ttl_seconds: 1800,
      access_mode: 'ro',
      snapshot_mode: 'staged',
      background: true,
    };

    const result = delegateSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should validate delegate params with multi-resource', () => {
    const params: DelegateParams = {
      description: 'Refactor code',
      prompt: 'Refactor the authentication module',
      resources: [
        { name: 'src', path: '/project/src', mode: 'rw' },
        { name: 'data', path: '/project/data', mode: 'ro' },
      ],
      peer_url: 'http://localhost:4001/awcp',
    };

    const result = delegateSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should validate delegate params with auth', () => {
    const params: DelegateParams = {
      description: 'Test',
      prompt: 'Test task',
      workspace_dir: '/path',
      peer_url: 'http://localhost:4001/awcp',
      auth_type: 'bearer',
      auth_credential: 'token123',
    };

    const result = delegateSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should reject invalid peer_url', () => {
    const params = {
      description: 'Test',
      prompt: 'Test task',
      workspace_dir: '/path',
      peer_url: 'not-a-url',
    };

    const result = delegateSchema.safeParse(params);
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const params = {
      description: 'Test',
    };

    const result = delegateSchema.safeParse(params);
    expect(result.success).toBe(false);
  });

  it('should reject invalid access_mode', () => {
    const params = {
      description: 'Test',
      prompt: 'Test task',
      workspace_dir: '/path',
      peer_url: 'http://localhost:4001/awcp',
      access_mode: 'invalid',
    };

    const result = delegateSchema.safeParse(params);
    expect(result.success).toBe(false);
  });

  it('should reject invalid snapshot_mode', () => {
    const params = {
      description: 'Test',
      prompt: 'Test task',
      workspace_dir: '/path',
      peer_url: 'http://localhost:4001/awcp',
      snapshot_mode: 'invalid',
    };

    const result = delegateSchema.safeParse(params);
    expect(result.success).toBe(false);
  });
});

describe('delegate_output tool schema', () => {
  it('should validate valid output params', () => {
    const params: DelegateOutputParams = {
      delegation_id: 'dlg_abc123',
    };

    const result = delegateOutputSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should validate output params with blocking', () => {
    const params: DelegateOutputParams = {
      delegation_id: 'dlg_abc123',
      block: true,
      timeout: 120,
    };

    const result = delegateOutputSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should reject missing delegation_id', () => {
    const params = {
      block: true,
    };

    const result = delegateOutputSchema.safeParse(params);
    expect(result.success).toBe(false);
  });

  it('should reject negative timeout', () => {
    const params = {
      delegation_id: 'dlg_abc123',
      timeout: -10,
    };

    const result = delegateOutputSchema.safeParse(params);
    expect(result.success).toBe(false);
  });
});

describe('delegate_cancel tool schema', () => {
  it('should validate cancel with delegation_id', () => {
    const params: DelegateCancelParams = {
      delegation_id: 'dlg_abc123',
    };

    const result = delegateCancelSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should validate cancel all', () => {
    const params: DelegateCancelParams = {
      all: true,
    };

    const result = delegateCancelSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should validate empty params (both optional)', () => {
    const params: DelegateCancelParams = {};

    const result = delegateCancelSchema.safeParse(params);
    expect(result.success).toBe(true);
  });
});

describe('delegate_snapshots tool schema', () => {
  it('should validate valid params', () => {
    const params: DelegateSnapshotsParams = {
      delegation_id: 'dlg_abc123',
    };

    const result = delegateSnapshotsSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should reject missing delegation_id', () => {
    const params = {};

    const result = delegateSnapshotsSchema.safeParse(params);
    expect(result.success).toBe(false);
  });
});

describe('delegate_apply_snapshot tool schema', () => {
  it('should validate valid params', () => {
    const params: DelegateApplySnapshotParams = {
      delegation_id: 'dlg_abc123',
      snapshot_id: 'snap_xyz789',
    };

    const result = delegateApplySnapshotSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should reject missing snapshot_id', () => {
    const params = {
      delegation_id: 'dlg_abc123',
    };

    const result = delegateApplySnapshotSchema.safeParse(params);
    expect(result.success).toBe(false);
  });

  it('should reject missing delegation_id', () => {
    const params = {
      snapshot_id: 'snap_xyz789',
    };

    const result = delegateApplySnapshotSchema.safeParse(params);
    expect(result.success).toBe(false);
  });
});

describe('delegate_discard_snapshot tool schema', () => {
  it('should validate valid params', () => {
    const params: DelegateDiscardSnapshotParams = {
      delegation_id: 'dlg_abc123',
      snapshot_id: 'snap_xyz789',
    };

    const result = delegateDiscardSnapshotSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should reject missing snapshot_id', () => {
    const params = {
      delegation_id: 'dlg_abc123',
    };

    const result = delegateDiscardSnapshotSchema.safeParse(params);
    expect(result.success).toBe(false);
  });
});

describe('delegate_recover tool schema', () => {
  it('should validate valid params', () => {
    const params: DelegateRecoverParams = {
      delegation_id: 'dlg_abc123',
      peer_url: 'http://executor:4001/awcp',
    };

    const result = delegateRecoverSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should reject invalid peer_url', () => {
    const params = {
      delegation_id: 'dlg_abc123',
      peer_url: 'not-a-url',
    };

    const result = delegateRecoverSchema.safeParse(params);
    expect(result.success).toBe(false);
  });

  it('should reject missing fields', () => {
    const params = {
      delegation_id: 'dlg_abc123',
    };

    const result = delegateRecoverSchema.safeParse(params);
    expect(result.success).toBe(false);
  });
});

/**
 * Tests for AWCP MCP Server tools
 */

import { describe, it, expect } from 'vitest';
import { delegateSchema, type DelegateParams } from '../src/tools/delegate.js';
import { delegateOutputSchema, type DelegateOutputParams } from '../src/tools/delegate-output.js';
import { delegateCancelSchema, type DelegateCancelParams } from '../src/tools/delegate-cancel.js';

describe('delegate tool schema', () => {
  it('should validate valid delegate params', () => {
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
      background: true,
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
      // missing prompt, workspace_dir, peer_url
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

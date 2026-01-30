/**
 * AWCP Executor Service
 *
 * Handles the AWCP delegation protocol on the Executor side.
 */

import { randomUUID } from 'node:crypto';
import type { Message } from '@a2a-js/sdk';
import {
  DefaultExecutionEventBus,
  type AgentExecutor,
  type AgentExecutionEvent,
} from '@a2a-js/sdk/server';
import {
  type InviteMessage,
  type StartMessage,
  type AcceptMessage,
  type DoneMessage,
  type ErrorMessage,
  type AwcpMessage,
  type TaskSpec,
  type ExecutorConstraints,
  type ExecutorTransportAdapter,
  PROTOCOL_VERSION,
  ErrorCodes,
  AwcpError,
} from '@awcp/core';
import { type ExecutorConfig, type ResolvedExecutorConfig, resolveExecutorConfig } from './config.js';
import { LocalPolicy } from './policy.js';
import { DelegatorClient } from './delegator-client.js';

interface PendingInvitation {
  invite: InviteMessage;
  delegatorUrl: string;
  receivedAt: Date;
}

interface ActiveDelegation {
  id: string;
  delegatorUrl: string;
  workDir: string;
  task: TaskSpec;
  startedAt: Date;
}

export interface ExecutorServiceStatus {
  pendingInvitations: number;
  activeDelegations: number;
  delegations: Array<{
    id: string;
    workDir: string;
    startedAt: string;
  }>;
}

export interface ExecutorServiceOptions {
  executor: AgentExecutor;
  config: ExecutorConfig;
}

export class ExecutorService {
  private executor: AgentExecutor;
  private config: ResolvedExecutorConfig;
  private transport: ExecutorTransportAdapter;
  private policy: LocalPolicy;
  private delegatorClient: DelegatorClient;
  private pendingInvitations = new Map<string, PendingInvitation>();
  private activeDelegations = new Map<string, ActiveDelegation>();

  constructor(options: ExecutorServiceOptions) {
    this.executor = options.executor;
    this.config = resolveExecutorConfig(options.config);
    this.transport = this.config.transport;
    this.policy = new LocalPolicy({
      mountRoot: this.config.mount.root,
      maxConcurrent: this.config.policy.maxConcurrentDelegations,
    });
    this.delegatorClient = new DelegatorClient();
  }

  async handleMessage(
    message: AwcpMessage,
    delegatorUrl: string
  ): Promise<AwcpMessage | null> {
    switch (message.type) {
      case 'INVITE':
        return this.handleInvite(message, delegatorUrl);
      case 'START':
        await this.handleStart(message, delegatorUrl);
        return null;
      case 'ERROR':
        await this.handleError(message);
        return null;
      default:
        throw new Error(`Unexpected message type: ${(message as AwcpMessage).type}`);
    }
  }

  private async handleInvite(
    invite: InviteMessage,
    delegatorUrl: string
  ): Promise<AcceptMessage | ErrorMessage> {
    const { delegationId } = invite;

    if (!this.policy.canAcceptMore()) {
      return this.createErrorMessage(
        delegationId,
        ErrorCodes.DECLINED,
        'Maximum concurrent delegations reached',
        'Try again later when current tasks complete'
      );
    }

    const maxTtl = this.config.policy.maxTtlSeconds;
    if (invite.lease.ttlSeconds > maxTtl) {
      return this.createErrorMessage(
        delegationId,
        ErrorCodes.DECLINED,
        `Requested TTL (${invite.lease.ttlSeconds}s) exceeds maximum (${maxTtl}s)`,
        `Request a shorter TTL (max: ${maxTtl}s)`
      );
    }

    const allowedModes = this.config.policy.allowedAccessModes;
    if (!allowedModes.includes(invite.lease.accessMode)) {
      return this.createErrorMessage(
        delegationId,
        ErrorCodes.DECLINED,
        `Access mode '${invite.lease.accessMode}' not allowed`,
        `Allowed modes: ${allowedModes.join(', ')}`
      );
    }

    const depCheck = await this.transport.checkDependency();
    if (!depCheck.available) {
      return this.createErrorMessage(
        delegationId,
        ErrorCodes.DEP_MISSING,
        `Transport ${this.transport.type} is not available`,
        depCheck.hint
      );
    }

    if (this.config.hooks.onInvite) {
      const accepted = await this.config.hooks.onInvite(invite);
      if (!accepted) {
        return this.createErrorMessage(
          delegationId,
          ErrorCodes.DECLINED,
          'Invitation declined by policy',
          'The agent declined this delegation request'
        );
      }
    } else if (!this.config.policy.autoAccept) {
      this.pendingInvitations.set(delegationId, {
        invite,
        delegatorUrl,
        receivedAt: new Date(),
      });
      return this.createErrorMessage(
        delegationId,
        ErrorCodes.DECLINED,
        'Manual acceptance required but no hook provided',
        'Configure autoAccept: true or provide onInvite hook'
      );
    }

    const mountPoint = this.policy.allocateMountPoint(delegationId);

    const validation = await this.policy.validateMountPoint(mountPoint);
    if (!validation.valid) {
      await this.policy.releaseMountPoint(mountPoint);
      return this.createErrorMessage(
        delegationId,
        ErrorCodes.MOUNTPOINT_DENIED,
        validation.reason ?? 'Mount point validation failed',
        'Check mount root configuration'
      );
    }

    this.pendingInvitations.set(delegationId, {
      invite,
      delegatorUrl,
      receivedAt: new Date(),
    });

    const executorConstraints: ExecutorConstraints = {
      acceptedAccessMode: invite.lease.accessMode,
      maxTtlSeconds: Math.min(invite.lease.ttlSeconds, maxTtl),
      sandboxProfile: this.config.sandbox,
    };

    const acceptMessage: AcceptMessage = {
      version: PROTOCOL_VERSION,
      type: 'ACCEPT',
      delegationId,
      executorMount: { mountPoint },
      executorConstraints,
    };

    return acceptMessage;
  }

  private async handleStart(start: StartMessage, delegatorUrl: string): Promise<void> {
    const { delegationId } = start;

    const pending = this.pendingInvitations.get(delegationId);
    if (!pending) {
      console.warn(`[AWCP] Unknown delegation for START: ${delegationId}`);
      return;
    }

    const targetDir = this.policy.allocateMountPoint(delegationId);
    this.pendingInvitations.delete(delegationId);

    try {
      await this.policy.prepareMountPoint(targetDir);

      const workDir = await this.transport.setup({
        delegationId,
        mountInfo: start.mount,
        targetDir,
      });

      this.activeDelegations.set(delegationId, {
        id: delegationId,
        delegatorUrl,
        workDir,
        task: pending.invite.task,
        startedAt: new Date(),
      });

      this.config.hooks.onTaskStart?.(delegationId, workDir);

      const result = await this.executeViaA2A(workDir, pending.invite.task);

      await this.transport.teardown({ delegationId, workDir });

      const doneMessage: DoneMessage = {
        version: PROTOCOL_VERSION,
        type: 'DONE',
        delegationId,
        finalSummary: result.summary,
        highlights: result.highlights,
      };

      await this.delegatorClient.send(delegatorUrl, doneMessage);
      this.config.hooks.onTaskComplete?.(delegationId, result.summary);

      this.activeDelegations.delete(delegationId);
      await this.policy.releaseMountPoint(workDir);
    } catch (error) {
      await this.transport.teardown({ delegationId, workDir: targetDir }).catch(() => {});
      this.activeDelegations.delete(delegationId);
      await this.policy.releaseMountPoint(targetDir);

      const errorMessage: ErrorMessage = {
        version: PROTOCOL_VERSION,
        type: 'ERROR',
        delegationId,
        code: ErrorCodes.TASK_FAILED,
        message: error instanceof Error ? error.message : String(error),
        hint: 'Check task requirements and try again',
      };

      await this.delegatorClient.send(delegatorUrl, errorMessage).catch(console.error);
      this.config.hooks.onError?.(
        delegationId,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async handleError(error: ErrorMessage): Promise<void> {
    const { delegationId } = error;

    const delegation = this.activeDelegations.get(delegationId);
    if (delegation) {
      await this.transport.teardown({ delegationId, workDir: delegation.workDir }).catch(() => {});
      this.activeDelegations.delete(delegationId);
      await this.policy.releaseMountPoint(delegation.workDir);
    }

    this.pendingInvitations.delete(delegationId);

    this.config.hooks.onError?.(
      delegationId,
      new AwcpError(error.code as any, error.message, error.hint, delegationId)
    );
  }

  async cancelDelegation(delegationId: string): Promise<void> {
    const delegation = this.activeDelegations.get(delegationId);
    if (delegation) {
      await this.transport.teardown({ delegationId, workDir: delegation.workDir }).catch(() => {});
      this.activeDelegations.delete(delegationId);
      await this.policy.releaseMountPoint(delegation.workDir);
      this.config.hooks.onError?.(
        delegationId,
        new AwcpError(ErrorCodes.CANCELLED, 'Delegation cancelled by Delegator', undefined, delegationId)
      );
      return;
    }

    if (this.pendingInvitations.has(delegationId)) {
      this.pendingInvitations.delete(delegationId);
      return;
    }

    throw new Error(`Delegation not found: ${delegationId}`);
  }

  private async executeViaA2A(
    workDir: string,
    task: TaskSpec
  ): Promise<{ summary: string; highlights?: string[] }> {
    const message: Message = {
      kind: 'message',
      messageId: randomUUID(),
      role: 'user',
      parts: [
        { kind: 'text', text: task.prompt },
        {
          kind: 'text',
          text: `\n\n[AWCP Context]\nWorking directory: ${workDir}\nTask: ${task.description}`,
        },
      ],
    };

    const taskId = randomUUID();
    const contextId = randomUUID();
    const requestContext = new RequestContextImpl(message, taskId, contextId);

    const eventBus = new DefaultExecutionEventBus();
    const results: Message[] = [];

    eventBus.on('event', (event: AgentExecutionEvent) => {
      if (event.kind === 'message') {
        results.push(event);
      }
    });

    await this.executor.execute(requestContext, eventBus);

    const summary = results
      .flatMap((m) => m.parts)
      .filter((p): p is { kind: 'text'; text: string } => p.kind === 'text')
      .map((p) => p.text)
      .join('\n');

    return {
      summary: summary || 'Task completed',
    };
  }

  getStatus(): ExecutorServiceStatus {
    return {
      pendingInvitations: this.pendingInvitations.size,
      activeDelegations: this.activeDelegations.size,
      delegations: Array.from(this.activeDelegations.values()).map((d) => ({
        id: d.id,
        workDir: d.workDir,
        startedAt: d.startedAt.toISOString(),
      })),
    };
  }

  private createErrorMessage(
    delegationId: string,
    code: string,
    message: string,
    hint?: string
  ): ErrorMessage {
    return {
      version: PROTOCOL_VERSION,
      type: 'ERROR',
      delegationId,
      code,
      message,
      hint,
    };
  }
}

class RequestContextImpl {
  readonly userMessage: Message;
  readonly taskId: string;
  readonly contextId: string;
  readonly task?: undefined;
  readonly referenceTasks?: undefined;
  readonly context?: undefined;

  constructor(userMessage: Message, taskId: string, contextId: string) {
    this.userMessage = userMessage;
    this.taskId = taskId;
    this.contextId = contextId;
  }
}

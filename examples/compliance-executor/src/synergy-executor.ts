/**
 * Compliance Synergy Executor
 *
 * AgentExecutor that delegates to Synergy AI with compliance audit rules.
 * Injects server-side compliance policy and stamp asset path into the prompt.
 * The stamp image is a protected asset — never shared with delegators.
 */

import { v4 as uuidv4 } from 'uuid';
import http from 'node:http';
import https from 'node:https';
import type { Message } from '@a2a-js/sdk';
import type { AgentExecutor, RequestContext, ExecutionEventBus } from '@a2a-js/sdk/server';

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const LEASE_BUFFER_MS = 30 * 1000;

const COMPLIANCE_RULES = `
You are a contract compliance auditor. You have access to a protected official stamp stored on this server.

## Compliance Policy

A contract submission is COMPLIANT when the workspace contains:
1. At least one PDF file (the contract)
2. At least one image file as supporting evidence (ID card, invoice, license, etc.)
   - Accepted extensions: .png, .jpg, .jpeg, .bmp, .tiff, .webp

You do NOT need to verify the content of these files. Only check that the required file types are present.

## Workflow

Step 1: List all files in the workspace directory.

Step 2: Classify files:
  - PDF files → contract documents
  - Image files (.png/.jpg/.jpeg etc.) → evidence materials
  - Other files → ignore

Step 3: Decision:
  - If NO PDF found → reject: "No contract PDF found in workspace."
  - If PDF found but NO image evidence → reject with this exact guidance:
    "REJECTION: Contract submission is incomplete.
     Missing: Supporting evidence image (e.g. id_card.png, invoice_proof.jpg).
     Please add the required evidence file to the workspace and resubmit."
  - If BOTH PDF and at least one image found → APPROVED, proceed to stamping.

Step 4 (only if approved): Apply the official stamp to the first PDF found.
  Use Python with pymupdf to composite the stamp:

  pip install pymupdf
  
  Then run Python code like:
    import fitz
    doc = fitz.open("<PDF_PATH>")
    page = doc[0]
    stamp_rect = fitz.Rect(page.rect.width - 180, page.rect.height - 180,
                            page.rect.width - 30, page.rect.height - 30)
    page.insert_image(stamp_rect, filename="<STAMP_PATH>")
    doc.save("contract_signed.pdf")
    doc.close()

  Save the stamped result as "contract_signed.pdf" in the workspace.

Step 5: Report result:
  - If rejected: state what's missing and how to fix it.
  - If stamped: confirm success, mention the output file name.

IMPORTANT: The stamp image is a protected server-side asset. Do NOT copy it into the workspace.
`.trim();

export interface AwcpContext {
  workPath: string;
  leaseExpiresAt?: Date;
  delegationId?: string;
}

export class ComplianceSynergyExecutor implements AgentExecutor {
  private workingDirectory: string | null = null;
  private synergyUrl: string;
  private defaultTimeoutMs: number;
  private leaseExpiresAt: Date | null = null;
  private delegationId: string | null = null;
  private stampImagePath: string;

  constructor(synergyUrl: string, stampImagePath: string, defaultTimeoutMs = DEFAULT_TIMEOUT_MS) {
    this.synergyUrl = synergyUrl;
    this.stampImagePath = stampImagePath;
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  setWorkingDirectory(dir: string, context?: Omit<AwcpContext, 'workPath'>): void {
    this.workingDirectory = dir;
    this.leaseExpiresAt = context?.leaseExpiresAt ?? null;
    this.delegationId = context?.delegationId ?? null;

    const timeoutInfo = this.leaseExpiresAt
      ? `(lease expires: ${this.leaseExpiresAt.toISOString()})`
      : `(default timeout: ${this.defaultTimeoutMs / 1000}s)`;
    console.log(`[ComplianceExecutor] Working directory set to: ${dir} ${timeoutInfo}`);
  }

  clearWorkingDirectory(): void {
    this.workingDirectory = null;
    this.leaseExpiresAt = null;
    this.delegationId = null;
    console.log(`[ComplianceExecutor] Working directory cleared`);
  }

  private getTimeoutMs(): number {
    if (this.leaseExpiresAt) {
      const remainingMs = this.leaseExpiresAt.getTime() - Date.now() - LEASE_BUFFER_MS;
      if (remainingMs <= 0) {
        console.warn(`[ComplianceExecutor] Lease already expired or expiring soon`);
        return 1000;
      }
      return remainingMs;
    }
    return this.defaultTimeoutMs;
  }

  async execute(ctx: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    let prompt = '';
    for (const part of ctx.userMessage.parts) {
      if (part.kind === 'text') {
        prompt += part.text;
      }
    }

    const logPrefix = this.delegationId
      ? `[ComplianceExecutor:${this.delegationId.slice(0, 8)}]`
      : '[ComplianceExecutor]';
    console.log(`${logPrefix} Received task: ${prompt.slice(0, 100)}...`);

    if (!this.workingDirectory) {
      this.sendResponse(
        eventBus,
        ctx.contextId,
        'No workspace mounted. This executor requires AWCP delegation with a workspace.'
      );
      return;
    }

    try {
      const fullPrompt = this.buildCompliancePrompt(prompt);
      const result = await this.executeWithSynergy(fullPrompt);
      this.sendResponse(eventBus, ctx.contextId, result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${logPrefix} Error:`, msg);
      this.sendResponse(eventBus, ctx.contextId, `Error: ${msg}`);
    }
  }

  cancelTask = async (): Promise<void> => {
    console.log(`[ComplianceExecutor] Task cancelled`);
  };

  private buildCompliancePrompt(userPrompt: string): string {
    const rulesWithStamp = COMPLIANCE_RULES.replace('<STAMP_PATH>', this.stampImagePath);

    return [
      '=== COMPLIANCE AUDIT RULES (SERVER-SIDE POLICY) ===',
      rulesWithStamp,
      `\nOfficial stamp image path: ${this.stampImagePath}`,
      '',
      '=== DELEGATOR REQUEST ===',
      userPrompt,
      '',
      `=== WORKSPACE ===`,
      `Working directory: ${this.workingDirectory}`,
      'Please audit the workspace now and follow the compliance procedure above.',
    ].join('\n');
  }

  private async executeWithSynergy(prompt: string): Promise<string> {
    const timeoutMs = this.getTimeoutMs();
    console.log(`[ComplianceExecutor] Request timeout: ${Math.round(timeoutMs / 1000)}s`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const sessionRes = await fetch(`${this.synergyUrl}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-synergy-directory': this.workingDirectory!,
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      if (!sessionRes.ok) {
        throw new Error(`Failed to create Synergy session: ${sessionRes.status}`);
      }

      const session = await sessionRes.json() as { id: string };
      console.log(`[ComplianceExecutor] Created session: ${session.id}`);

      const result = await this.longPollPost(
        `${this.synergyUrl}/session/${session.id}/message`,
        { parts: [{ type: 'text', text: prompt }] },
        { 'Content-Type': 'application/json', 'x-synergy-directory': this.workingDirectory! },
        controller.signal,
      );

      console.log(`[ComplianceExecutor] Got response with ${result.parts?.length || 0} parts`);
      return this.extractResponseText(result);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Synergy request timed out after ${Math.round(timeoutMs / 1000)}s`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private longPollPost(
    url: string, body: unknown, headers: Record<string, string>, signal: AbortSignal,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const transport = parsed.protocol === 'https:' ? https : http;

      const req = transport.request(parsed, { method: 'POST', headers, signal }, (res) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Failed to send prompt: ${res.statusCode}`));
          }
        });
      });

      req.on('socket', (socket) => {
        socket.setTimeout(0);
        socket.setKeepAlive(true, 30_000);
      });
      req.on('error', reject);
      req.write(JSON.stringify(body));
      req.end();
    });
  }

  private extractResponseText(result: { info: any; parts: any[] }): string {
    if (!result.parts || result.parts.length === 0) {
      return 'Task completed (no output)';
    }

    const textParts: string[] = [];

    for (const part of result.parts) {
      if (part.type === 'text' && part.text) {
        textParts.push(part.text);
      } else if (part.type === 'tool-invocation' && part.toolName) {
        textParts.push(`[Tool: ${part.toolName}]`);
      }
    }

    return textParts.join('\n') || 'Task completed';
  }

  private sendResponse(eventBus: ExecutionEventBus, contextId: string, text: string): void {
    const response: Message = {
      kind: 'message',
      messageId: uuidv4(),
      role: 'agent',
      parts: [{ kind: 'text', text }],
      contextId,
    };
    eventBus.publish(response);
    eventBus.finished();
  }
}

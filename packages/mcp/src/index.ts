/**
 * @awcp/mcp - MCP tools for AWCP workspace delegation
 *
 * @example
 * ```typescript
 * import { createAwcpMcpServer } from '@awcp/mcp';
 * import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
 *
 * const server = createAwcpMcpServer({
 *   daemonUrl: 'http://localhost:3100',
 * });
 *
 * const transport = new StdioServerTransport();
 * await server.connect(transport);
 * ```
 */

export { createAwcpMcpServer, type AwcpMcpServerOptions } from './server.js';
export { DelegatorDaemonClient } from '@awcp/sdk/delegator/client';
export type { DelegateRequest, DelegateResponse, ListDelegationsResponse } from '@awcp/sdk/delegator/client';

// Tool schemas
export { delegateSchema, type DelegateParams } from './tools/delegate.js';
export { delegateOutputSchema, type DelegateOutputParams } from './tools/delegate-output.js';
export { delegateCancelSchema, type DelegateCancelParams } from './tools/delegate-cancel.js';
export { delegateSnapshotsSchema, type DelegateSnapshotsParams } from './tools/delegate-snapshots.js';
export { delegateApplySnapshotSchema, type DelegateApplySnapshotParams } from './tools/delegate-apply-snapshot.js';
export { delegateDiscardSnapshotSchema, type DelegateDiscardSnapshotParams } from './tools/delegate-discard-snapshot.js';
export { delegateRecoverSchema, type DelegateRecoverParams } from './tools/delegate-recover.js';

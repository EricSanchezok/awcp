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

// Tool schemas (for external use)
export { delegateSchema, type DelegateParams } from './tools/delegate.js';
export {
  delegateOutputSchema,
  type DelegateOutputParams,
} from './tools/delegate-output.js';
export {
  delegateCancelSchema,
  type DelegateCancelParams,
} from './tools/delegate-cancel.js';

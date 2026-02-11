/**
 * @awcp/transport-git
 *
 * Git-based transport for AWCP workspace delegation.
 * Supports GitHub, GitLab, Gitea, and self-hosted Git servers.
 */

export { GitDelegatorTransport } from './delegator/transport.js';
export { GitExecutorTransport } from './executor/transport.js';

export type { GitDelegatorTransportConfig, GitExecutorTransportConfig } from './types.js';

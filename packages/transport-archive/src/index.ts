/**
 * @awcp/transport-archive
 *
 * Archive-based transport for AWCP workspace delegation.
 * Uses base64-encoded ZIP archives transmitted inline in protocol messages.
 */

export { ArchiveTransport } from './archive-transport.js';

export type {
  ArchiveTransportConfig,
  ArchiveDelegatorConfig,
  ArchiveExecutorConfig,
  ArchiveCreateResult,
  ArchiveWorkDirInfo,
} from './types.js';

export { ArchiveCreator } from './delegator/index.js';
export { ArchiveExtractor } from './executor/index.js';

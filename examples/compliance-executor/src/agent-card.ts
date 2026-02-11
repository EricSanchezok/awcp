/**
 * Agent Card for Compliance Executor
 *
 * Contract compliance audit and official stamping service.
 * Enforces document completeness rules before applying stamps.
 */

import type { AgentCard } from '@a2a-js/sdk';
import { loadConfig } from './config.js';

const config = loadConfig();

export const complianceAgentCard: AgentCard = {
  name: 'Compliance Auditor',
  description: [
    'Contract compliance audit and official stamp service.',
    'Powered by Synergy AI agent with document analysis capabilities.',
    '',
    'Submit a workspace with contract documents for compliance review.',
    'If approved, the official stamp is applied and a signed PDF is returned.',
    'If rejected, a detailed explanation with remediation steps is provided.',
    '',
    'The official stamp is a protected asset stored only on this server.',
    'Operates on delegated workspaces via AWCP protocol.',
  ].join('\n'),
  url: config.agentUrl,
  version: '0.1.0',
  protocolVersion: '0.2.1',
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  skills: [
    {
      id: 'compliance-audit',
      name: 'Contract Compliance Audit',
      description: 'Audit contract documents for compliance. Verifies that all required materials are present before approving.',
      tags: ['compliance', 'audit', 'contract', 'legal', 'verification'],
      examples: [
        'Audit the workspace for contract compliance',
        'Check if all required documents are present for stamping',
        'Verify contract submission completeness',
      ],
    },
    {
      id: 'document-stamping',
      name: 'Official Document Stamping',
      description: 'Apply the official stamp to compliant contract documents. Only stamps documents that pass all compliance checks. Produces a signed PDF with the official seal.',
      tags: ['stamp', 'seal', 'sign', 'official', 'pdf'],
      examples: [
        'Stamp the contract after compliance check passes',
        'Apply official seal to the approved document',
      ],
    },
  ],
};

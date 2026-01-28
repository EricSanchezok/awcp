/**
 * Echo Agent Card Definition
 */

import { AgentCard } from '@a2a-js/sdk';

export const echoAgentCard: AgentCard = {
  name: 'Echo Agent',
  description: 'A simple echo agent that replies with the received message',
  protocolVersion: '0.3.0',
  version: '0.1.0',
  url: 'http://localhost:4001/a2a',
  skills: [
    { id: 'echo', name: 'Echo', description: 'Echoes back messages', tags: ['echo'] }
  ],
  capabilities: {
    pushNotifications: false,
  },
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
};

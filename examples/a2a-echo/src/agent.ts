/**
 * Simple A2A Echo Agent
 * 
 * Echoes back any message it receives with "Received: xxx"
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AgentCard, Message, AGENT_CARD_PATH } from '@a2a-js/sdk';
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
  DefaultRequestHandler,
  InMemoryTaskStore,
} from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, UserBuilder } from '@a2a-js/sdk/server/express';

// 1. Agent Card - Describes who this agent is
const echoAgentCard: AgentCard = {
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

// 2. Agent logic - Simple echo
class EchoExecutor implements AgentExecutor {
  async execute(ctx: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const userMessage = ctx.userMessage;
    let receivedText = '';
    
    for (const part of userMessage.parts) {
      if (part.kind === 'text') {
        receivedText += part.text;
      }
    }

    console.log(`[EchoAgent] Received: ${receivedText}`);

    const response: Message = {
      kind: 'message',
      messageId: uuidv4(),
      role: 'agent',
      parts: [{ kind: 'text', text: `Received: ${receivedText}` }],
      contextId: ctx.contextId,
    };

    eventBus.publish(response);
    eventBus.finished();
  }

  cancelTask = async (): Promise<void> => {};
}

// 3. Assemble and start server
const requestHandler = new DefaultRequestHandler(
  echoAgentCard,
  new InMemoryTaskStore(),
  new EchoExecutor()
);

const app = express();

// Agent Card 端点
app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));

// JSON-RPC 端点
app.use('/a2a', jsonRpcHandler({ 
  requestHandler, 
  userBuilder: UserBuilder.noAuthentication 
}));

const PORT = 4001;

app.listen(PORT, () => {
  console.log(`Echo Agent started`);
  console.log(`  Agent Card: http://localhost:${PORT}/${AGENT_CARD_PATH}`);
  console.log(`  JSON-RPC:   http://localhost:${PORT}/a2a`);
});

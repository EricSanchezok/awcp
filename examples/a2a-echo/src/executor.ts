/**
 * Echo Agent Executor - The actual agent logic
 */

import { v4 as uuidv4 } from 'uuid';
import { Message } from '@a2a-js/sdk';
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
} from '@a2a-js/sdk/server';

export class EchoExecutor implements AgentExecutor {
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

/**
 * A2A Client - Send messages to Echo Agent
 */

import { v4 as uuidv4 } from 'uuid';
import { ClientFactory } from '@a2a-js/sdk/client';
import { Message, MessageSendParams } from '@a2a-js/sdk';

async function main() {
  const factory = new ClientFactory();

  console.log('Connecting to Echo Agent...');
  const client = await factory.createFromUrl('http://localhost:4001');

  const testMessage = process.argv[2] || 'Hello, A2A!';

  const sendParams: MessageSendParams = {
    message: {
      messageId: uuidv4(),
      role: 'user',
      parts: [{ kind: 'text', text: testMessage }],
      kind: 'message',
    },
  };

  console.log(`Sending: ${testMessage}`);

  try {
    const response = await client.sendMessage(sendParams);
    const result = response as Message;
    
    if (result.parts && result.parts[0] && result.parts[0].kind === 'text') {
      console.log(`Reply: ${result.parts[0].text}`);
    } else {
      console.log('Reply:', result);
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

main();

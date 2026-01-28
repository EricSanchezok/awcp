/**
 * HTTP Client for sending AWCP messages to Host
 */

import type { AwcpMessage } from '@awcp/core';

/**
 * Client for sending AWCP messages back to the Host daemon
 */
export class HostClient {
  private timeout: number;

  constructor(options?: { timeout?: number }) {
    this.timeout = options?.timeout ?? 30000;
  }

  /**
   * Send an AWCP message to the Host
   */
  async send(hostUrl: string, message: AwcpMessage): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(hostUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `Failed to send ${message.type} to host: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

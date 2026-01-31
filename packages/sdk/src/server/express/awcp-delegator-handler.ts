/**
 * AWCP Delegator Express Handler
 *
 * Express middleware for enabling AWCP Delegator functionality.
 */

import { Router, json } from 'express';
import type { DelegatorConfig } from '../../delegator/config.js';
import { DelegatorService } from '../../delegator/service.js';

/**
 * Options for the AWCP Delegator Express handler
 */
export interface DelegatorHandlerOptions {
  config: DelegatorConfig;
}

/**
 * Result of creating the handler
 */
export interface DelegatorHandlerResult {
  router: Router;
  service: DelegatorService;
}

/**
 * Create an Express router that handles AWCP Delegator messages
 */
export function delegatorHandler(options: DelegatorHandlerOptions): DelegatorHandlerResult {
  const router = Router();
  const service = new DelegatorService({
    config: options.config,
  });

  router.use(json());

  /**
   * GET /status - Get service status
   */
  router.get('/status', (_req, res) => {
    res.json(service.getStatus());
  });

  /**
   * GET /delegation/:id - Get delegation details
   */
  router.get('/delegation/:id', (req, res) => {
    const delegation = service.getDelegation(req.params.id);
    if (!delegation) {
      res.status(404).json({ error: 'Delegation not found' });
      return;
    }
    res.json(delegation);
  });

  /**
   * DELETE /delegation/:id - Cancel a delegation
   */
  router.delete('/delegation/:id', async (req, res) => {
    try {
      await service.cancel(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to cancel',
      });
    }
  });

  return { router, service };
}

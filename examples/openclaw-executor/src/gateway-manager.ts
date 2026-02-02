import { spawn, ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { OpenClawExecutorConfig } from './config.js';

export interface OpenClawModelConfig {
  id: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
}

export interface OpenClawProviderConfig {
  baseUrl: string;
  apiKey: string;
  api: string;
  models: OpenClawModelConfig[];
}

export interface OpenClawConfig {
  gateway: {
    port: number;
    auth: {
      mode: 'token';
      token: string;
    };
    http: {
      endpoints: {
        chatCompletions: { enabled: boolean };
      };
    };
  };
  models?: {
    mode: 'merge';
    providers: Record<string, OpenClawProviderConfig>;
  };
  agents: {
    defaults: {
      workspace: string;
      skipBootstrap: boolean;
      model?: { primary: string };
    };
  };
  tools: {
    profile: string;
  };
}

export class OpenClawGatewayManager {
  private process: ChildProcess | null = null;
  private config: OpenClawExecutorConfig;
  private configPath: string;
  private isStarted = false;

  constructor(config: OpenClawExecutorConfig) {
    this.config = config;
    this.configPath = path.join(config.openclawConfigDir, 'openclaw.json');
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      console.log('[GatewayManager] Gateway already started');
      return;
    }

    await this.ensureDirectories();
    await this.writeConfig();

    console.log(`[GatewayManager] Starting OpenClaw Gateway on port ${this.config.gatewayPort}...`);

    this.process = spawn('openclaw', [
      'gateway',
      '--port', String(this.config.gatewayPort),
      '--token', this.config.gatewayToken,
      '--allow-unconfigured',
    ], {
      env: {
        ...process.env,
        OPENCLAW_STATE_DIR: this.config.openclawConfigDir,
        OPENCLAW_GATEWAY_TOKEN: this.config.gatewayToken,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const logFile = path.join(this.config.logsDir, 'openclaw-gateway.log');
    const logStream = await fs.open(logFile, 'a');

    this.process.stdout?.on('data', (data) => {
      logStream.write(data);
    });

    this.process.stderr?.on('data', (data) => {
      logStream.write(data);
    });

    this.process.on('error', (err) => {
      console.error('[GatewayManager] Gateway process error:', err);
    });

    this.process.on('exit', (code, signal) => {
      console.log(`[GatewayManager] Gateway exited with code ${code}, signal ${signal}`);
      this.isStarted = false;
    });

    await this.waitForHealth();
    this.isStarted = true;
    console.log(`[GatewayManager] Gateway started (PID: ${this.process.pid})`);
  }

  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    console.log('[GatewayManager] Stopping Gateway...');
    this.process.kill('SIGTERM');

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.process?.kill('SIGKILL');
        resolve();
      }, 5000);

      this.process?.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.process = null;
    this.isStarted = false;
    console.log('[GatewayManager] Gateway stopped');
  }

  async updateWorkspace(workspacePath: string): Promise<void> {
    console.log(`[GatewayManager] Updating workspace to: ${workspacePath}`);
    
    const openclawConfig = this.generateConfig(workspacePath);
    await fs.writeFile(this.configPath, JSON.stringify(openclawConfig, null, 2));
  }

  async checkHealth(): Promise<boolean> {
    try {
      // OpenClaw gateway returns HTML on root, check if server responds
      const response = await fetch(`${this.config.gatewayUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.gatewayToken}`,
        },
        body: JSON.stringify({
          model: 'test',
          messages: [],
        }),
        signal: AbortSignal.timeout(2000),
      });
      // 400 or 401 means server is up, just invalid request
      return response.status === 400 || response.status === 401 || response.status === 404 || response.ok;
    } catch {
      return false;
    }
  }

  private async waitForHealth(timeoutMs = 30000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await this.checkHealth()) {
        return;
      }
      await sleep(500);
    }
    throw new Error('Gateway health check timeout');
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.config.openclawConfigDir, { recursive: true });
    await fs.mkdir(this.config.logsDir, { recursive: true });
    await fs.mkdir(this.config.workDir, { recursive: true });
    await fs.mkdir(this.config.tempDir, { recursive: true });
  }

  private async writeConfig(): Promise<void> {
    const openclawConfig = this.generateConfig(this.config.workDir);
    await fs.writeFile(this.configPath, JSON.stringify(openclawConfig, null, 2));
  }

  private generateConfig(workspace: string): OpenClawConfig {
    const config: OpenClawConfig = {
      gateway: {
        port: this.config.gatewayPort,
        auth: {
          mode: 'token',
          token: this.config.gatewayToken,
        },
        http: {
          endpoints: {
            chatCompletions: { enabled: true },
          },
        },
      },
      agents: {
        defaults: {
          workspace,
          skipBootstrap: true,
        },
      },
      tools: {
        profile: 'coding',
      },
    };

    // Configure model provider based on available API keys
    if (process.env.DEEPSEEK_API_KEY) {
      config.models = {
        mode: 'merge',
        providers: {
          deepseek: {
            baseUrl: 'https://api.deepseek.com/v1',
            apiKey: '${DEEPSEEK_API_KEY}',
            api: 'openai-completions',
            models: [
              {
                id: 'deepseek-chat',
                name: 'DeepSeek Chat',
                contextWindow: 64000,
                maxTokens: 8192,
              },
            ],
          },
        },
      };
      config.agents.defaults.model = { primary: 'deepseek/deepseek-chat' };
    } else if (process.env.OPENROUTER_API_KEY) {
      config.models = {
        mode: 'merge',
        providers: {
          openrouter: {
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: '${OPENROUTER_API_KEY}',
            api: 'openai-completions',
            models: [
              {
                id: 'anthropic/claude-sonnet-4',
                name: 'Claude Sonnet 4',
                contextWindow: 200000,
                maxTokens: 8192,
              },
            ],
          },
        },
      };
      config.agents.defaults.model = { primary: 'openrouter/anthropic/claude-sonnet-4' };
    }
    // For ANTHROPIC_API_KEY and OPENAI_API_KEY, OpenClaw has built-in support

    return config;
  }

  get pid(): number | undefined {
    return this.process?.pid;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface OpenClawExecutorConfig {
  port: number;
  gatewayPort: number;
  gatewayToken: string;
  gatewayUrl: string;
  scenarioDir: string;
  workDir: string;
  tempDir: string;
  logsDir: string;
  openclawConfigDir: string;
}

export function loadConfig(): OpenClawExecutorConfig {
  const scenarioDir = process.env.SCENARIO_DIR || path.resolve(__dirname, '..');
  const port = parseInt(process.env.PORT || '10200', 10);
  const gatewayPort = parseInt(process.env.OPENCLAW_PORT || '18789', 10);
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || generateToken();
  const gatewayUrl = process.env.OPENCLAW_URL || `http://127.0.0.1:${gatewayPort}`;

  return {
    port,
    gatewayPort,
    gatewayToken,
    gatewayUrl,
    scenarioDir,
    workDir: path.join(scenarioDir, 'workdir'),
    tempDir: path.join(scenarioDir, 'temp'),
    logsDir: path.join(scenarioDir, 'logs'),
    openclawConfigDir: path.join(scenarioDir, '.openclaw'),
  };
}

function generateToken(): string {
  return 'awcp-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

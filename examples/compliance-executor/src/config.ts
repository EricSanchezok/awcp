/**
 * Compliance Executor Configuration
 */

export interface Config {
  port: number;
  agentUrl: string;
  synergyUrl: string;
  synergyAutoStart: boolean;
  scenarioDir: string;
  logFile?: string;
  stampImagePath: string;
}

export function loadConfig(): Config {
  const port = parseInt(process.env.PORT || '10300', 10);
  const hasExternalSynergy = !!process.env.SYNERGY_URL;
  const scenarioDir = process.env.SCENARIO_DIR || process.cwd();

  return {
    port,
    agentUrl: process.env.AGENT_URL || `http://localhost:${port}`,
    synergyUrl: process.env.SYNERGY_URL || 'http://localhost:2026',
    synergyAutoStart: process.env.SYNERGY_AUTO_START
      ? process.env.SYNERGY_AUTO_START !== 'false'
      : !hasExternalSynergy,
    scenarioDir,
    logFile: process.env.LOG_FILE || parseLogFileArg(),
    stampImagePath: process.env.STAMP_IMAGE || new URL('../assets/official_stamp.png', import.meta.url).pathname,
  };
}

function parseLogFileArg(): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--log-file' && args[i + 1]) {
      return args[i + 1];
    }
  }
  return undefined;
}

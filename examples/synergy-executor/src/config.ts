/**
 * Synergy Executor Configuration
 */

export interface Config {
  port: number;
  synergyUrl: string;
  synergyAutoStart: boolean;
  scenarioDir: string;
}

export function loadConfig(): Config {
  return {
    port: parseInt(process.env.PORT || '10200', 10),
    synergyUrl: process.env.SYNERGY_URL || 'http://localhost:4096',
    synergyAutoStart: process.env.SYNERGY_AUTO_START !== 'false',
    scenarioDir: process.env.SCENARIO_DIR || process.cwd(),
  };
}

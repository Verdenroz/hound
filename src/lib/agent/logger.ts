import { AgentState, AgentLog } from './types';

export class Logger {
  private logs: AgentLog[] = [];
  private maxLogs: number = 1000;

  log(state: AgentState, message: string, data?: any): AgentLog {
    const logEntry: AgentLog = {
      timestamp: new Date().toISOString(),
      state,
      message,
      data,
    };

    this.logs.push(logEntry);

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output with color coding
    const stateColor = this.getStateColor(state);
    console.log(`${stateColor}[${state}]\x1b[0m ${message}`, data || '');

    return logEntry;
  }

  private getStateColor(state: AgentState): string {
    const colors: Record<AgentState, string> = {
      [AgentState.IDLE]: '\x1b[90m', // Gray
      [AgentState.MONITORING]: '\x1b[36m', // Cyan
      [AgentState.ANALYZING]: '\x1b[33m', // Yellow
      [AgentState.DECIDING]: '\x1b[35m', // Magenta
      [AgentState.RISK_CHECK]: '\x1b[34m', // Blue
      [AgentState.EXECUTING]: '\x1b[31m', // Red
      [AgentState.EXPLAINING]: '\x1b[32m', // Green
    };
    return colors[state] || '\x1b[0m';
  }

  getLogs(limit?: number): AgentLog[] {
    if (limit) {
      return this.logs.slice(-limit);
    }
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }
}

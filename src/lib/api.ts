const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface AgentStatus {
  state: string;
  isRunning: boolean;
  wallet: string | null;
  portfolio: any;
  logs: any[];
  currentNews: any;
  currentAnalysis: any;
  currentDecision: any;
}

export const api = {
  async getAgentStatus(): Promise<AgentStatus> {
    const response = await fetch(`${API_BASE}/api/agent/status`);
    if (!response.ok) throw new Error('Failed to fetch agent status');
    return response.json();
  },

  async startAgent(): Promise<void> {
    const response = await fetch(`${API_BASE}/api/agent/start`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to start agent');
  },

  async stopAgent(): Promise<void> {
    const response = await fetch(`${API_BASE}/api/agent/stop`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to stop agent');
  },

  async getPortfolio(): Promise<any> {
    const response = await fetch(`${API_BASE}/api/portfolio`);
    if (!response.ok) throw new Error('Failed to fetch portfolio');
    return response.json();
  },

  async getTrades(limit?: number): Promise<any> {
    const url = limit
      ? `${API_BASE}/api/trades?limit=${limit}`
      : `${API_BASE}/api/trades`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch trades');
    return response.json();
  },

  async getLogs(limit?: number): Promise<any> {
    const url = limit
      ? `${API_BASE}/api/logs?limit=${limit}`
      : `${API_BASE}/api/logs`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch logs');
    return response.json();
  },
};

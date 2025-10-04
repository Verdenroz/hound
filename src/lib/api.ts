import { getAccessToken } from '@auth0/nextjs-auth0';

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

async function getAuthHeaders(): Promise<HeadersInit> {
  try {
    const token = await getAccessToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  } catch (error) {
    // Not authenticated, return empty headers
    return {
      'Content-Type': 'application/json',
    };
  }
}

export const api = {
  async getAgentStatus(): Promise<AgentStatus> {
    const response = await fetch(`${API_BASE}/api/agent/status`);
    if (!response.ok) throw new Error('Failed to fetch agent status');
    return response.json();
  },

  async startAgent(): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/agent/start`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) throw new Error('Failed to start agent');
  },

  async stopAgent(): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/agent/stop`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) throw new Error('Failed to stop agent');
  },

  async getPortfolio(): Promise<any> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/portfolio`, { headers });
    if (!response.ok) throw new Error('Failed to fetch portfolio');
    return response.json();
  },

  async getTrades(limit?: number): Promise<any> {
    const headers = await getAuthHeaders();
    const url = limit
      ? `${API_BASE}/api/trades?limit=${limit}`
      : `${API_BASE}/api/trades`;
    const response = await fetch(url, { headers });
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

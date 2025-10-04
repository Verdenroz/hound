// All operations use Next.js API routes
const API_BASE = '/api';

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

export interface UserInfo {
  email?: string;
  name?: string;
}

function getAuthHeaders(user?: UserInfo): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (user?.email) {
    headers['x-user-email'] = user.email;
    if (user.name) {
      headers['x-user-name'] = user.name;
    }
  }

  return headers;
}

export const api = {
  // Agent operations (use Next.js API routes)
  async getAgentStatus(): Promise<AgentStatus> {
    const response = await fetch(`${API_BASE}/agent/status`);
    if (!response.ok) throw new Error('Failed to fetch agent status');
    return response.json();
  },

  async startAgent(): Promise<void> {
    const response = await fetch(`${API_BASE}/agent/start`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to start agent');
  },

  async stopAgent(): Promise<void> {
    const response = await fetch(`${API_BASE}/agent/stop`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to stop agent');
  },

  async executeAgentCycle(): Promise<void> {
    const response = await fetch(`${API_BASE}/agent/execute`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to execute agent cycle');
  },

  // User data operations (use Next.js API routes with Supabase)
  async getTrades(limit?: number): Promise<any> {
    const url = limit
      ? `${API_BASE}/trades?limit=${limit}`
      : `${API_BASE}/trades`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch trades');
    return response.json();
  },

  async getLogs(limit?: number): Promise<any> {
    const url = limit
      ? `${API_BASE}/logs?limit=${limit}`
      : `${API_BASE}/logs`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch logs');
    return response.json();
  },

  async getEvents(limit?: number): Promise<any> {
    const url = limit
      ? `${API_BASE}/events?limit=${limit}`
      : `${API_BASE}/events`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json();
  },

  // Portfolio operations (use Next.js API routes with Supabase)
  async getPortfolio(): Promise<any> {
    const response = await fetch(`${API_BASE}/portfolio`);
    if (!response.ok) throw new Error('Failed to fetch portfolio');
    return response.json();
  },

  async searchTickers(query: string): Promise<any> {
    const response = await fetch(`${API_BASE}/tickers/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search tickers');
    return response.json();
  },

  async addTicker(ticker: string, _user?: UserInfo, shares?: number, avgPrice?: number): Promise<any> {
    const response = await fetch(`${API_BASE}/portfolio/holdings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ticker, shares, avg_price: avgPrice }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to add ticker' }));
      throw new Error(error.error || 'Failed to add ticker');
    }
    return response.json();
  },

  async updateCashBalance(cashBalance: number): Promise<any> {
    const response = await fetch(`${API_BASE}/portfolio/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cash_balance: cashBalance }),
    });
    if (!response.ok) throw new Error('Failed to update cash balance');
    return response.json();
  },
};

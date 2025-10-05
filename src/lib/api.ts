// Backend API base URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export interface AgentStatus {
  initialized?: boolean;
  state: string;
  isRunning: boolean;
  wallet: string | null;
  portfolio: any;
  logs: any[];
  currentNews: any;
  currentAnalysis: any;
  currentDecision: any;
}

export interface UserConfig {
  configured: boolean;
  config: {
    holdings: Array<{ ticker: string; shares: number; avg_price: number }>;
    cash_balance: number;
    risk_tolerance: string;
  } | null;
}

export interface TickerSearchResult {
  name: string;
  symbol: string;
  exchange: string;
  type: 'stock' | 'etf' | 'trust';
  logo?: string;
}

export const api = {
  // User configuration operations
  async getUserConfig(email: string): Promise<UserConfig> {
    const response = await fetch(`${BACKEND_URL}/api/user/configure?email=${encodeURIComponent(email)}`);
    if (!response.ok) throw new Error('Failed to fetch user config');
    return response.json();
  },

  async createUserConfig(
    email: string,
    cashBalance: number,
    riskTolerance: string,
    holdings: Array<{ ticker: string; shares: number; avg_price: number }> = []
  ): Promise<any> {
    const response = await fetch(`${BACKEND_URL}/api/user/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        cash_balance: cashBalance,
        risk_tolerance: riskTolerance,
        holdings,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to create user config' }));
      throw new Error(error.error || 'Failed to create user config');
    }
    return response.json();
  },

  async updateUserConfig(
    email: string,
    updates: {
      cash_balance?: number;
      risk_tolerance?: string;
      holdings?: Array<{ ticker: string; shares: number; avg_price: number }>;
    }
  ): Promise<any> {
    const response = await fetch(`${BACKEND_URL}/api/user/configure`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ...updates }),
    });
    if (!response.ok) throw new Error('Failed to update user config');
    return response.json();
  },

  // Agent operations (direct backend calls)
  async getAgentStatus(email: string): Promise<AgentStatus> {
    const response = await fetch(`${BACKEND_URL}/api/agent/status?email=${encodeURIComponent(email)}`);
    if (!response.ok) throw new Error('Failed to fetch agent status');
    return response.json();
  },

  async startAgent(email: string): Promise<void> {
    const response = await fetch(`${BACKEND_URL}/api/agent/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to start agent' }));
      throw new Error(error.error || 'Failed to start agent');
    }
  },

  async stopAgent(email: string): Promise<void> {
    const response = await fetch(`${BACKEND_URL}/api/agent/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) throw new Error('Failed to stop agent');
  },

  // User data operations (direct backend calls)
  async getTrades(email: string, limit?: number): Promise<any> {
    const url = limit
      ? `${BACKEND_URL}/api/trades?email=${encodeURIComponent(email)}&limit=${limit}`
      : `${BACKEND_URL}/api/trades?email=${encodeURIComponent(email)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch trades');
    return response.json();
  },

  async getLogs(email: string, limit?: number): Promise<any> {
    const url = limit
      ? `${BACKEND_URL}/api/logs?email=${encodeURIComponent(email)}&limit=${limit}`
      : `${BACKEND_URL}/api/logs?email=${encodeURIComponent(email)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch logs');
    return response.json();
  },

  async getEvents(email: string, limit?: number): Promise<any> {
    const url = limit
      ? `${BACKEND_URL}/api/events?email=${encodeURIComponent(email)}&limit=${limit}`
      : `${BACKEND_URL}/api/events?email=${encodeURIComponent(email)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json();
  },

  async getNews(email: string, limit?: number): Promise<any> {
    const url = limit
      ? `${BACKEND_URL}/api/news?email=${encodeURIComponent(email)}&limit=${limit}`
      : `${BACKEND_URL}/api/news?email=${encodeURIComponent(email)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch news');
    return response.json();
  },

  // Portfolio operations (direct backend calls)
  async getPortfolio(email: string): Promise<any> {
    const response = await fetch(`${BACKEND_URL}/api/portfolio?email=${encodeURIComponent(email)}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch portfolio');
    }
    return response.json();
  },

  // Ticker search (backend endpoint using finance-query API)
  async searchTickers(query: string, hits: number = 10, type?: 'stock' | 'etf' | 'trust'): Promise<TickerSearchResult[]> {
    let url = `${BACKEND_URL}/api/tickers/search?q=${encodeURIComponent(query)}&hits=${hits}`;
    if (type) {
      url += `&type=${type}`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to search tickers');
    const results = await response.json();

    // Add logo URLs to each result
    return results.map((result: TickerSearchResult) => ({
      ...result,
      logo: `https://img.logo.dev/ticker/${result.symbol}?token=pk_Xd1Cdye3QYmCOXzcvxhxyw&retina=true`
    }));
  },
};

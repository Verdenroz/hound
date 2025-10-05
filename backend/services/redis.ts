import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TTL_DAYS = 30;
const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;

class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      console.log('✅ Redis connected');
    });

    this.client.on('error', (err) => {
      console.error('❌ Redis error:', err);
    });
  }

  // Helper to set TTL on keys
  private async setTTL(key: string): Promise<void> {
    await this.client.expire(key, TTL_SECONDS);
  }

  // User methods
  async getOrCreateUser(email: string, auth0Sub?: string, name?: string) {
    const key = `user:${email}`;
    const exists = await this.client.exists(key);

    if (exists) {
      const user = await this.client.hgetall(key);

      // Update auth0_sub and name if provided and different
      if (auth0Sub && user.auth0_sub !== auth0Sub) {
        await this.client.hset(key, 'auth0_sub', auth0Sub);
      }
      if (name && user.name !== name) {
        await this.client.hset(key, 'name', name);
      }

      await this.setTTL(key);
      return {
        id: user.id,
        email: user.email,
        auth0_sub: user.auth0_sub,
        name: user.name,
        created_at: user.created_at,
      };
    }

    // Create new user
    const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const userData = {
      id: userId,
      email,
      auth0_sub: auth0Sub || '',
      name: name || '',
      created_at: new Date().toISOString(),
    };

    await this.client.hset(key, userData);
    await this.setTTL(key);

    return userData;
  }

  // Portfolio methods
  async initializePortfolio(
    email: string,
    cashBalance: number,
    riskTolerance: string,
    holdings: Array<{ ticker: string; shares: number; avg_price: number }> = []
  ): Promise<void> {
    const portfolioKey = `portfolio:${email}`;
    const holdingsKey = `holdings:${email}`;

    // Create portfolio
    await this.client.hset(portfolioKey, {
      cash_balance: cashBalance.toString(),
      risk_tolerance: riskTolerance,
      onboarding_completed: 'true',
    });
    await this.setTTL(portfolioKey);

    // Create holdings if provided
    if (holdings.length > 0) {
      for (const holding of holdings) {
        const holdingData = JSON.stringify({
          shares: holding.shares,
          avg_price: holding.avg_price,
        });
        await this.client.hset(holdingsKey, holding.ticker, holdingData);
      }
      await this.setTTL(holdingsKey);
    }
  }

  async hasUserConfig(email: string): Promise<boolean> {
    const portfolioKey = `portfolio:${email}`;
    return (await this.client.exists(portfolioKey)) === 1;
  }

  async updateUserConfig(
    email: string,
    updates: {
      cash_balance?: number;
      risk_tolerance?: string;
      holdings?: Array<{ ticker: string; shares: number; avg_price: number }>;
    }
  ): Promise<void> {
    const portfolioKey = `portfolio:${email}`;
    const holdingsKey = `holdings:${email}`;

    // Update portfolio settings
    if (updates.cash_balance !== undefined || updates.risk_tolerance !== undefined) {
      const updateData: any = {};
      if (updates.cash_balance !== undefined) {
        updateData.cash_balance = updates.cash_balance.toString();
      }
      if (updates.risk_tolerance !== undefined) {
        updateData.risk_tolerance = updates.risk_tolerance;
      }
      await this.client.hset(portfolioKey, updateData);
      await this.setTTL(portfolioKey);
    }

    // Update holdings if provided
    if (updates.holdings !== undefined) {
      // Clear existing holdings
      await this.client.del(holdingsKey);

      // Set new holdings
      if (updates.holdings.length > 0) {
        for (const holding of updates.holdings) {
          const holdingData = JSON.stringify({
            shares: holding.shares,
            avg_price: holding.avg_price,
          });
          await this.client.hset(holdingsKey, holding.ticker, holdingData);
        }
        await this.setTTL(holdingsKey);
      }
    }
  }

  async getPortfolio(email: string) {
    const portfolioKey = `portfolio:${email}`;
    const holdingsKey = `holdings:${email}`;

    const [portfolio, holdings] = await Promise.all([
      this.client.hgetall(portfolioKey),
      this.client.hgetall(holdingsKey),
    ]);

    // Check if portfolio exists
    if (!portfolio || Object.keys(portfolio).length === 0) {
      return null;
    }

    await this.setTTL(portfolioKey);
    await this.setTTL(holdingsKey);

    // Parse holdings from hash
    const holdingsArray = Object.entries(holdings).map(([ticker, data]) => {
      const parsed = JSON.parse(data);
      return {
        ticker,
        shares: parseFloat(parsed.shares),
        avg_price: parseFloat(parsed.avg_price),
      };
    });

    return {
      holdings: holdingsArray,
      cash_balance: parseFloat(portfolio.cash_balance),
      risk_tolerance: portfolio.risk_tolerance,
    };
  }

  async updatePortfolio(email: string, updates: {
    cash_balance?: number;
    risk_tolerance?: string;
    onboarding_completed?: boolean;
  }): Promise<void> {
    const portfolioKey = `portfolio:${email}`;
    const updateData: any = {};

    if (updates.cash_balance !== undefined) {
      updateData.cash_balance = updates.cash_balance.toString();
    }
    if (updates.risk_tolerance !== undefined) {
      updateData.risk_tolerance = updates.risk_tolerance;
    }
    if (updates.onboarding_completed !== undefined) {
      updateData.onboarding_completed = updates.onboarding_completed.toString();
    }

    await this.client.hset(portfolioKey, updateData);
    await this.setTTL(portfolioKey);
  }

  // Holdings methods
  async getHoldings(email: string) {
    const holdingsKey = `holdings:${email}`;
    const holdings = await this.client.hgetall(holdingsKey);
    await this.setTTL(holdingsKey);

    return Object.entries(holdings).map(([ticker, data]) => {
      const parsed = JSON.parse(data);
      return {
        ticker,
        shares: parseFloat(parsed.shares),
        avg_price: parseFloat(parsed.avg_price),
      };
    });
  }

  async addHolding(email: string, ticker: string, shares: number = 0, avgPrice: number = 0): Promise<void> {
    const holdingsKey = `holdings:${email}`;

    // Check if already exists
    const exists = await this.client.hexists(holdingsKey, ticker);
    if (exists) {
      throw new Error(`Ticker ${ticker} already exists in portfolio`);
    }

    const holdingData = JSON.stringify({ shares, avg_price: avgPrice });
    await this.client.hset(holdingsKey, ticker, holdingData);
    await this.setTTL(holdingsKey);
  }

  async updateHolding(email: string, ticker: string, shares: number, avgPrice?: number): Promise<void> {
    const holdingsKey = `holdings:${email}`;
    const existing = await this.client.hget(holdingsKey, ticker);

    if (!existing) {
      throw new Error(`Ticker ${ticker} not found in portfolio`);
    }

    const parsed = JSON.parse(existing);
    const updated = {
      shares,
      avg_price: avgPrice !== undefined ? avgPrice : parsed.avg_price,
    };

    await this.client.hset(holdingsKey, ticker, JSON.stringify(updated));
    await this.setTTL(holdingsKey);
  }

  async removeHolding(email: string, ticker: string): Promise<void> {
    const holdingsKey = `holdings:${email}`;
    await this.client.hdel(holdingsKey, ticker);
    await this.setTTL(holdingsKey);
  }

  // Trades methods
  async addTrade(email: string, trade: any): Promise<void> {
    const tradesKey = `trades:${email}`;
    const tradeData = JSON.stringify({
      ...trade,
      timestamp: Date.now(),
    });

    await this.client.lpush(tradesKey, tradeData);
    await this.client.ltrim(tradesKey, 0, 999); // Keep last 1000 trades
    await this.setTTL(tradesKey);
  }

  async getTrades(email: string, limit: number = 50) {
    const tradesKey = `trades:${email}`;
    const trades = await this.client.lrange(tradesKey, 0, limit - 1);
    await this.setTTL(tradesKey);

    return trades.map((t) => JSON.parse(t));
  }

  // Logs methods
  async addLog(email: string, log: any): Promise<void> {
    const logsKey = `logs:${email}`;
    const logData = JSON.stringify({
      ...log,
      timestamp: Date.now(),
    });

    await this.client.lpush(logsKey, logData);
    await this.client.ltrim(logsKey, 0, 499); // Keep last 500 logs
    await this.setTTL(logsKey);
  }

  async getLogs(email: string, limit: number = 20) {
    const logsKey = `logs:${email}`;
    const logs = await this.client.lrange(logsKey, 0, limit - 1);
    await this.setTTL(logsKey);

    return logs.map((l) => JSON.parse(l));
  }

  // Events methods
  async addEvent(email: string, event: any): Promise<void> {
    const eventsKey = `events:${email}`;
    const eventData = JSON.stringify({
      ...event,
      timestamp: Date.now(),
    });

    await this.client.lpush(eventsKey, eventData);
    await this.client.ltrim(eventsKey, 0, 499); // Keep last 500 events
    await this.setTTL(eventsKey);
  }

  async getEvents(email: string, limit: number = 50) {
    const eventsKey = `events:${email}`;
    const events = await this.client.lrange(eventsKey, 0, limit - 1);
    await this.setTTL(eventsKey);

    return events.map((e) => JSON.parse(e));
  }

  // Agent session methods
  async startAgentSession(email: string): Promise<string> {
    const sessionKey = `agent_session:${email}`;
    const sessionId = `session_${Date.now()}`;

    await this.client.hset(sessionKey, {
      session_id: sessionId,
      started_at: new Date().toISOString(),
      status: 'active',
      is_running: 'true',
      trades_count: '0',
    });
    await this.setTTL(sessionKey);

    return sessionId;
  }

  async stopAgentSession(email: string, tradesCount: number = 0): Promise<void> {
    const sessionKey = `agent_session:${email}`;

    await this.client.hset(sessionKey, {
      stopped_at: new Date().toISOString(),
      status: 'stopped',
      is_running: 'false',
      trades_count: tradesCount.toString(),
    });
    await this.setTTL(sessionKey);
  }

  async getAgentSession(email: string) {
    const sessionKey = `agent_session:${email}`;
    const session = await this.client.hgetall(sessionKey);
    await this.setTTL(sessionKey);

    if (!session || Object.keys(session).length === 0) {
      return null;
    }

    return {
      session_id: session.session_id,
      started_at: session.started_at,
      stopped_at: session.stopped_at,
      status: session.status,
      is_running: session.is_running === 'true',
      trades_count: parseInt(session.trades_count || '0'),
    };
  }

  // Cleanup method
  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

export const redis = new RedisService();

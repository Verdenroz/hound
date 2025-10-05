import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import * as dotenv from 'dotenv';
import { AgentOrchestrator, AgentEvent } from './agent/orchestrator';
import { redis } from './services/redis';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// User-specific agents
const agents = new Map<string, AgentOrchestrator>();

// API keys from environment
const tavilyApiKey = process.env.TAVILY_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
const walletSeed = process.env.XRPL_WALLET_SEED;

if (!tavilyApiKey) {
  console.error('❌ TAVILY_API_KEY not found in environment variables');
  process.exit(1);
}

if (!geminiApiKey) {
  console.error('❌ GEMINI_API_KEY not found in environment variables');
  process.exit(1);
}

// Get or create user-specific agent
async function getUserAgent(email: string): Promise<AgentOrchestrator> {
  let agent = agents.get(email);

  if (!agent) {
    agent = new AgentOrchestrator(email, tavilyApiKey!, geminiApiKey!, walletSeed);
    await agent.initialize();

    // Set up event forwarding to WebSocket clients for this user
    agent.onEvent((event: AgentEvent) => {
      broadcastToUserClients(email, {
        type: 'agent_event',
        event,
      });
    });

    agents.set(email, agent);
    console.log(`✅ Agent initialized for user: ${email}`);
  }

  return agent;
}

// HTTP Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// User configuration endpoints
app.get('/api/user/configure', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const hasConfig = await redis.hasUserConfig(email);
    if (!hasConfig) {
      return res.json({ configured: false, config: null });
    }

    const portfolio = await redis.getPortfolio(email);
    res.json({
      configured: true,
      config: portfolio,
    });
  } catch (error) {
    console.error('Error fetching user config:', error);
    res.status(500).json({ error: 'Failed to fetch user configuration' });
  }
});

app.post('/api/user/configure', async (req: Request, res: Response) => {
  try {
    const { email, cash_balance, risk_tolerance, holdings } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (cash_balance === undefined || cash_balance === null) {
      return res.status(400).json({ error: 'cash_balance is required' });
    }

    if (!risk_tolerance) {
      return res.status(400).json({ error: 'risk_tolerance is required' });
    }

    // Check if user already has config
    const hasConfig = await redis.hasUserConfig(email);
    if (hasConfig) {
      return res.status(400).json({ error: 'User already has configuration. Use PUT to update.' });
    }

    // Initialize portfolio
    await redis.initializePortfolio(
      email,
      parseFloat(cash_balance),
      risk_tolerance,
      holdings || []
    );

    const portfolio = await redis.getPortfolio(email);
    res.json({ success: true, portfolio });
  } catch (error) {
    console.error('Error creating user config:', error);
    res.status(500).json({ error: 'Failed to create user configuration' });
  }
});

app.put('/api/user/configure', async (req: Request, res: Response) => {
  try {
    const { email, cash_balance, risk_tolerance, holdings } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user has config
    const hasConfig = await redis.hasUserConfig(email);
    if (!hasConfig) {
      return res.status(400).json({ error: 'User not configured. Use POST to create configuration.' });
    }

    // Update config
    const updates: {
      cash_balance?: number;
      risk_tolerance?: string;
      holdings?: Array<{ ticker: string; shares: number; avg_price: number }>;
    } = {};
    if (cash_balance !== undefined) {
      updates.cash_balance = parseFloat(cash_balance);
    }
    if (risk_tolerance !== undefined) {
      updates.risk_tolerance = risk_tolerance;
    }
    if (holdings !== undefined) {
      updates.holdings = holdings;
    }

    await redis.updateUserConfig(email, updates);

    const portfolio = await redis.getPortfolio(email);
    res.json({ success: true, portfolio });
  } catch (error) {
    console.error('Error updating user config:', error);
    res.status(500).json({ error: 'Failed to update user configuration' });
  }
});

app.delete('/api/portfolio/holding', async (req: Request, res: Response) => {
  try {
    const { email, ticker } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }

    // Check if user has config
    const hasConfig = await redis.hasUserConfig(email);
    if (!hasConfig) {
      return res.status(400).json({ error: 'User not configured' });
    }

    await redis.removeHolding(email, ticker);

    const portfolio = await redis.getPortfolio(email);
    res.json({ success: true, portfolio });
  } catch (error) {
    console.error('Error removing holding:', error);
    res.status(500).json({ error: 'Failed to remove holding' });
  }
});

app.get('/api/agent/status', async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const agent = agents.get(email);

    if (!agent) {
      return res.json({
        initialized: false,
        isRunning: false,
      });
    }

    res.json({
      initialized: true,
      state: agent.getState(),
      isRunning: agent.isAgentRunning(),
      wallet: agent.getWalletAddress(),
      portfolio: await agent.getPortfolio(),
      logs: agent.getLogs(20),
      currentNews: agent.getCurrentNews(),
      currentAnalysis: agent.getCurrentAnalysis(),
      currentDecision: agent.getCurrentDecision(),
    });
  } catch (error) {
    console.error('Error fetching agent status:', error);
    res.status(500).json({ error: 'Failed to fetch agent status' });
  }
});

app.post('/api/agent/start', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user has configured their portfolio
    const hasConfig = await redis.hasUserConfig(email);
    if (!hasConfig) {
      return res.status(400).json({ error: 'Please configure your portfolio first' });
    }

    const agent = await getUserAgent(email);

    if (agent.isAgentRunning()) {
      return res.status(400).json({ error: 'Agent is already running' });
    }

    await agent.start();

    res.json({ success: true, message: 'Agent started' });
  } catch (error) {
    console.error('Error starting agent:', error);
    res.status(500).json({ error: 'Failed to start agent' });
  }
});

app.post('/api/agent/stop', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const agent = agents.get(email);

    if (!agent) {
      return res.status(400).json({ error: 'Agent not initialized' });
    }

    agent.stop();

    res.json({ success: true, message: 'Agent stopped' });
  } catch (error) {
    console.error('Error stopping agent:', error);
    res.status(500).json({ error: 'Failed to stop agent' });
  }
});

app.get('/api/portfolio', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const portfolio = await redis.getPortfolio(email);

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found. Please configure your portfolio first.' });
    }

    res.json(portfolio);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

app.get('/api/trades', async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const trades = await redis.getTrades(email, limit);
    res.json({ trades });
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

app.get('/api/logs', async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const logs = await redis.getLogs(email, limit);
    res.json({ logs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

app.get('/api/events', async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const events = await redis.getEvents(email, limit);
    res.json({ events });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.get('/api/news', async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const news = await redis.getNews(email, limit);
    res.json({ news });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// Ticker search endpoint using finance-query API
app.get('/api/tickers/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const hits = req.query.hits ? parseInt(req.query.hits as string) : 10;
    const type = req.query.type as string | undefined;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Call finance-query API
    const url = new URL('https://finance-query.onrender.com/v1/search');
    url.searchParams.set('query', query);
    url.searchParams.set('hits', Math.min(Math.max(hits, 1), 100).toString());
    if (type) {
      url.searchParams.set('type', type);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Finance API error: ${response.statusText}`);
    }

    const results = await response.json();
    res.json(results);
  } catch (error) {
    console.error('Error searching tickers:', error);
    res.status(500).json({ error: 'Failed to search tickers' });
  }
});

// Create HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

interface UserWebSocket extends WebSocket {
  userEmail?: string;
}

const clients = new Map<string, Set<UserWebSocket>>();

wss.on('connection', (ws: UserWebSocket, req) => {
  console.log('🔌 WebSocket client connected');

  // Extract user email from query params
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const email = url.searchParams.get('email');

  if (!email) {
    ws.send(JSON.stringify({ error: 'Email is required in query params' }));
    ws.close();
    return;
  }

  ws.userEmail = email;

  // Add to user's client set
  if (!clients.has(email)) {
    clients.set(email, new Set());
  }
  clients.get(email)!.add(ws);

  console.log(`🔌 WebSocket client connected for user: ${email}`);

  // Send initial state if agent exists for this user
  const agent = agents.get(email);
  if (agent) {
    agent.getPortfolio().then(portfolio => {
      ws.send(
        JSON.stringify({
          type: 'initial_state',
          data: {
            state: agent.getState(),
            isRunning: agent.isAgentRunning(),
            portfolio: portfolio,
            wallet: agent.getWalletAddress(),
          },
        })
      );
    }).catch(err => {
      console.error('Error sending initial state:', err);
    });
  }

  ws.on('close', () => {
    console.log(`🔌 WebSocket client disconnected for user: ${email}`);
    const userClients = clients.get(email);
    if (userClients) {
      userClients.delete(ws);
      if (userClients.size === 0) {
        clients.delete(email);
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    const userClients = clients.get(email);
    if (userClients) {
      userClients.delete(ws);
      if (userClients.size === 0) {
        clients.delete(email);
      }
    }
  });
});

function broadcastToUserClients(email: string, message: unknown) {
  const data = JSON.stringify(message);
  const userClients = clients.get(email);

  if (userClients) {
    userClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}

// Start server
async function start() {
  try {
    server.listen(PORT, () => {
      console.log(`🚀 Hound Backend Server running on http://localhost:${PORT}`);
      console.log(`🔌 WebSocket server running on ws://localhost:${PORT}/ws`);
      console.log('\n📡 API Endpoints:');
      console.log(`   GET    /api/health`);
      console.log(`   GET    /api/user/configure`);
      console.log(`   POST   /api/user/configure`);
      console.log(`   PUT    /api/user/configure`);
      console.log(`   GET    /api/agent/status`);
      console.log(`   POST   /api/agent/start`);
      console.log(`   POST   /api/agent/stop`);
      console.log(`   GET    /api/portfolio`);
      console.log(`   DELETE /api/portfolio/holding`);
      console.log(`   GET    /api/trades`);
      console.log(`   GET    /api/logs`);
      console.log(`   GET    /api/events`);
      console.log(`   GET    /api/news`);
      console.log(`   GET    /api/tickers/search`);
      console.log('\n💡 Multi-user agent system ready');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');

  // Shutdown all active agents
  for (const [email, agent] of agents.entries()) {
    console.log(`Shutting down agent for ${email}...`);
    await agent.shutdown();
  }

  // Disconnect Redis
  await redis.disconnect();

  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

start();
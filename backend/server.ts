import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import * as dotenv from 'dotenv';
import { AgentOrchestrator, AgentEvent } from './agent/orchestrator';
import { requireAuth, optionalAuth } from './middleware/auth';
import { getOrCreateUser, getUserPortfolio } from './services/supabase';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize agent
let agent: AgentOrchestrator | null = null;

async function initializeAgent() {
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

  agent = new AgentOrchestrator(tavilyApiKey, geminiApiKey, walletSeed);

  await agent.initialize();

  console.log('✅ Agent initialized successfully');

  // Set up event forwarding to WebSocket clients
  agent.onEvent((event: AgentEvent) => {
    broadcastToClients({
      type: 'agent_event',
      event,
    });
  });
}

// HTTP Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/agent/status', (req: Request, res: Response) => {
  if (!agent) {
    return res.status(500).json({ error: 'Agent not initialized' });
  }

  res.json({
    state: agent.getState(),
    isRunning: agent.isAgentRunning(),
    wallet: agent.getWalletAddress(),
    portfolio: agent.getPortfolio(),
    logs: agent.getLogs(20),
    currentNews: agent.getCurrentNews(),
    currentAnalysis: agent.getCurrentAnalysis(),
    currentDecision: agent.getCurrentDecision(),
  });
});

// User profile endpoint (protected)
app.get('/api/user/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await getOrCreateUser(req.user.sub, req.user.email, req.user.name);
    const { portfolio, holdings } = await getUserPortfolio(user.id);

    res.json({
      user,
      portfolio,
      holdings,
    });
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

app.post('/api/agent/start', requireAuth, async (req: Request, res: Response) => {
  if (!agent) {
    return res.status(500).json({ error: 'Agent not initialized' });
  }

  if (agent.isAgentRunning()) {
    return res.status(400).json({ error: 'Agent is already running' });
  }

  // TODO: In future, create user-specific agent instance
  // For now, use the shared agent but track user session
  await agent.start();

  res.json({ success: true, message: 'Agent started' });
});

app.post('/api/agent/stop', requireAuth, (req: Request, res: Response) => {
  if (!agent) {
    return res.status(500).json({ error: 'Agent not initialized' });
  }

  agent.stop();

  res.json({ success: true, message: 'Agent stopped' });
});

app.get('/api/portfolio', optionalAuth, async (req: Request, res: Response) => {
  try {
    // If Supabase is configured and user is authenticated, use user-specific portfolio
    if (req.user && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const user = await getOrCreateUser(req.user.sub, req.user.email, req.user.name);
      const { portfolio, holdings } = await getUserPortfolio(user.id);

      return res.json({
        holdings: holdings.map((h) => ({
          ticker: h.ticker,
          shares: h.shares,
          avg_price: h.avg_price,
        })),
        cash_balance: portfolio.cash_balance,
        risk_tolerance: portfolio.risk_tolerance,
      });
    }

    // Fallback to agent's portfolio (for development without Supabase)
    if (!agent) {
      return res.status(500).json({ error: 'Agent not initialized' });
    }

    res.json(agent.getPortfolio());
  } catch (error: any) {
    console.error('Error fetching portfolio:', error);

    // Fallback to agent portfolio on error
    if (agent) {
      return res.json(agent.getPortfolio());
    }

    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

app.get('/api/trades', optionalAuth, async (req: Request, res: Response) => {
  try {
    // If Supabase is configured and user is authenticated, use user-specific trades
    if (req.user && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const user = await getOrCreateUser(req.user.sub, req.user.email, req.user.name);
      const { getUserTrades } = await import('./services/supabase');
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const trades = await getUserTrades(user.id, limit);

      return res.json({ trades });
    }

    // Fallback to agent's trades (for development without Supabase)
    if (!agent) {
      return res.status(500).json({ error: 'Agent not initialized' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    res.json({
      trades: agent.getTradeHistory(limit),
    });
  } catch (error: any) {
    console.error('Error fetching trades:', error);

    // Fallback to agent trades on error
    if (agent) {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      return res.json({
        trades: agent.getTradeHistory(limit),
      });
    }

    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

app.get('/api/logs', (req: Request, res: Response) => {
  if (!agent) {
    return res.status(500).json({ error: 'Agent not initialized' });
  }

  const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

  res.json({
    logs: agent.getLogs(limit),
  });
});

app.get('/api/events', (req: Request, res: Response) => {
  if (!agent) {
    return res.status(500).json({ error: 'Agent not initialized' });
  }

  res.json({
    events: agent.getEvents(),
  });
});

// Create HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

const clients: Set<WebSocket> = new Set();

wss.on('connection', (ws: WebSocket) => {
  console.log('🔌 WebSocket client connected');
  clients.add(ws);

  // Send initial state
  if (agent) {
    ws.send(
      JSON.stringify({
        type: 'initial_state',
        data: {
          state: agent.getState(),
          isRunning: agent.isAgentRunning(),
          portfolio: agent.getPortfolio(),
          wallet: agent.getWalletAddress(),
        },
      })
    );
  }

  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

function broadcastToClients(message: any) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Start server
async function start() {
  try {
    await initializeAgent();

    server.listen(PORT, () => {
      console.log(`🚀 Hound Backend Server running on http://localhost:${PORT}`);
      console.log(`🔌 WebSocket server running on ws://localhost:${PORT}/ws`);
      console.log('\n📡 API Endpoints:');
      console.log(`   GET  /api/health`);
      console.log(`   GET  /api/agent/status`);
      console.log(`   POST /api/agent/start`);
      console.log(`   POST /api/agent/stop`);
      console.log(`   GET  /api/portfolio`);
      console.log(`   GET  /api/trades`);
      console.log(`   GET  /api/logs`);
      console.log(`   GET  /api/events`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');

  if (agent) {
    await agent.shutdown();
  }

  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

start();

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@auth0/nextjs-auth0';
import { api, AgentStatus } from '@/lib/api';
import { AgentStatusPanel } from '@/components/AgentStatusPanel';
import { PortfolioPanel } from '@/components/PortfolioPanel';
import { NewsPanel } from '@/components/NewsPanel';
import { LogsPanel } from '@/components/LogsPanel';
import { TransactionHistory } from '@/components/TransactionHistory';
import { OnboardingModal } from '@/components/OnboardingModal';
import UserMenu from '@/components/UserMenu';

interface Holding {
  ticker: string;
  shares: number;
  avg_price: number;
}

interface Portfolio {
  holdings: Holding[];
  cash_balance: number;
  risk_tolerance: string;
}

interface Trade {
  ticker: string;
  action: 'buy' | 'sell';
  shares: number;
  price: number;
  timestamp: number;
}

interface AgentLog {
  timestamp: string;
  state: string;
  message: string;
  data?: unknown;
}

export default function Home() {
  const { user, isLoading: authLoading } = useUser();
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [portfolio, setPortfolio] = useState<unknown>(null);
  const [trades, setTrades] = useState<unknown[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Check user configuration
  useEffect(() => {
    if (!user?.email) {
      setIsConfigured(null);
      return;
    }

    const checkConfig = async () => {
      try {
        const config = await api.getUserConfig(user.email!);
        setIsConfigured(config.configured);
      } catch (error) {
        console.error('Failed to check user config:', error);
        setIsConfigured(false);
      }
    };

    checkConfig();
  }, [user?.email]);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!user?.email || !isConfigured) return;

    try {
      const [statusData, tradesData, portfolioData] = await Promise.all([
        api.getAgentStatus(user.email),
        api.getTrades(user.email, 50),
        api.getPortfolio(user.email),
      ]);

      setAgentStatus(statusData);
      setTrades((tradesData as { trades: unknown[] }).trades || []);
      setPortfolio(portfolioData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }, [user?.email, isConfigured]);

  // Setup WebSocket connection
  useEffect(() => {
    if (!user?.email || !isConfigured) return;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const wsUrl = backendUrl.replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/ws?email=${encodeURIComponent(user.email)}`);

    ws.onopen = () => {
      console.log('✅ WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'initial_state') {
          setAgentStatus((prev) => ({
            ...prev,
            ...message.data,
          } as AgentStatus));
        } else if (message.type === 'agent_event') {
          fetchData();
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [user?.email, isConfigured, fetchData]);

  // Poll data every 3 seconds
  useEffect(() => {
    if (!isConfigured) return;

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData, isConfigured]);

  const handleStart = async () => {
    if (!user?.email) return;

    setIsStarting(true);
    try {
      await api.startAgent(user.email);
      setTimeout(fetchData, 500);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start agent. Make sure the backend is running and API keys are configured.';
      console.error('Failed to start agent:', error);
      alert(errorMessage);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    if (!user?.email) return;

    setIsStopping(true);
    try {
      await api.stopAgent(user.email);
      setTimeout(fetchData, 500);
    } catch (error) {
      console.error('Failed to stop agent:', error);
    } finally {
      setIsStopping(false);
    }
  };

  const handleOnboardingComplete = () => {
    setIsConfigured(true);
  };

  // Show auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="absolute top-4 right-4">
          <UserMenu />
        </div>
        <div className="text-center max-w-md">
          <h1 className="text-5xl font-bold mb-4">
            🐕 Hound AI Agent
          </h1>
          <p className="text-muted-foreground mb-8">
            Autonomous Financial Trading Agent with RLUSD Blockchain Execution
          </p>
          <p className="text-foreground mb-6">
            Please sign in to access your personalized portfolio and start the AI trading agent.
          </p>
          <a
            href="/api/auth/login"
            className="inline-block px-8 py-3 text-lg font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
          >
            Login / Sign Up
          </a>
        </div>
      </div>
    );
  }

  // Show loading while checking configuration
  if (isConfigured === null) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking your profile...</p>
        </div>
      </div>
    );
  }

  // Show onboarding modal if not configured
  if (!isConfigured && user.email) {
    return (
      <>
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
          <div className="absolute top-4 right-4">
            <UserMenu />
          </div>
          <div className="text-center max-w-md">
            <h1 className="text-5xl font-bold mb-4">
              🐕 Hound AI Agent
            </h1>
            <p className="text-muted-foreground">
              Autonomous Financial Trading Agent
            </p>
          </div>
        </div>
        <OnboardingModal email={user.email} onComplete={handleOnboardingComplete} />
      </>
    );
  }

  // Show loading while fetching data
  if (!agentStatus) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Connecting to Hound Agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <header className="mb-8 space-y-4">
        {/* Row 1: Title & Settings */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">
              🐕 Hound AI Agent
            </h1>
            <p className="text-muted-foreground mt-2">
              Autonomous Financial Trading Agent with Blockchain Execution
            </p>
          </div>

          <UserMenu />
        </div>

        {/* Row 2: Agent Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${agentStatus?.isRunning ? 'bg-accent' : 'bg-muted'}`}></div>
            <span className="text-muted-foreground">
              {agentStatus?.isRunning ? 'Agent Running' : 'Agent Idle'}
            </span>
          </div>

          {agentStatus.isRunning ? (
            <button
              onClick={handleStop}
              disabled={isStopping}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-muted disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
            >
              {isStopping ? 'Stopping...' : '⏸ Stop Agent'}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={isStarting}
              className="px-6 py-2 bg-accent hover:bg-accent-hover disabled:bg-muted disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
            >
              {isStarting ? 'Starting...' : '▶ Start Agent'}
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-6">
        <AgentStatusPanel
          state={agentStatus.state}
          isRunning={agentStatus.isRunning}
          wallet={agentStatus.wallet}
        />

        <PortfolioPanel
          portfolio={portfolio as Portfolio | null}
          userEmail={user?.email || undefined}
          onUpdate={fetchData}
        />

        <NewsPanel userEmail={user?.email || undefined} />

        <LogsPanel logs={agentStatus.logs as AgentLog[] || []} />
      </div>

      <TransactionHistory trades={trades as Trade[]} />

      <footer className="mt-8 pt-6 border-t border-gray-800 text-center text-gray-500 text-sm">
        <p>
          Powered by{' '}
          <span className="text-blue-400">Tavily</span> •{' '}
          <span className="text-purple-400">Gemini</span> •{' '}
          <span className="text-green-400">XRPL</span>
        </p>
        <p className="mt-2">
          Built for MLH Hackathon - Emerging Technology Track
        </p>
      </footer>
    </div>
  );
}

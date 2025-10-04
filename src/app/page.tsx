'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@auth0/nextjs-auth0';
import { api, AgentStatus } from '@/lib/api';
import { AgentStatusPanel } from '@/components/AgentStatusPanel';
import { PortfolioPanel } from '@/components/PortfolioPanel';
import { NewsPanel } from '@/components/NewsPanel';
import { LogsPanel } from '@/components/LogsPanel';
import { TransactionHistory } from '@/components/TransactionHistory';
import UserMenu from '@/components/UserMenu';

export default function Home() {
  const { user, isLoading: authLoading } = useUser();
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const promises = [
        api.getAgentStatus(),
        api.getTrades(),
      ];

      // Only fetch portfolio if user is authenticated
      if (user) {
        promises.push(api.getPortfolio());
      }

      const results = await Promise.all(promises);
      setAgentStatus(results[0]);
      setTrades(results[1].trades || []);

      if (user && results[2]) {
        setPortfolio(results[2]);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }, [user]);

  // Execute agent cycle when running
  useEffect(() => {
    if (agentStatus?.isRunning && user) {
      const executeCycle = async () => {
        try {
          await api.executeAgentCycle();
          await fetchData();
        } catch (error) {
          console.error('Agent cycle error:', error);
        }
      };

      executeCycle();
    }
  }, [agentStatus?.isRunning, agentStatus?.state, user, fetchData]);

  useEffect(() => {
    fetchData();

    // Poll every 2 seconds
    const interval = setInterval(fetchData, 2000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await api.startAgent();
      setTimeout(fetchData, 500);
    } catch (error) {
      console.error('Failed to start agent:', error);
      alert('Failed to start agent. Make sure the backend is running and API keys are configured.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    setIsStopping(true);
    try {
      await api.stopAgent();
      setTimeout(fetchData, 500);
    } catch (error) {
      console.error('Failed to stop agent:', error);
    } finally {
      setIsStopping(false);
    }
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

        <PortfolioPanel portfolio={portfolio} user={user ? { email: user.email, name: user.name } : undefined} />

        <NewsPanel news={agentStatus.currentNews} />

        <LogsPanel logs={agentStatus.logs || []} />
      </div>

      <TransactionHistory trades={trades} />

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

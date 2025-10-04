'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, AgentStatus } from '@/lib/api';
import { useWebSocket } from '@/lib/websocket';
import { AgentStatusPanel } from '@/components/AgentStatusPanel';
import { PortfolioPanel } from '@/components/PortfolioPanel';
import { NewsPanel } from '@/components/NewsPanel';
import { LogsPanel } from '@/components/LogsPanel';
import { TransactionHistory } from '@/components/TransactionHistory';

export default function Home() {
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const [status, tradesData] = await Promise.all([
        api.getAgentStatus(),
        api.getTrades(),
      ]);
      setAgentStatus(status);
      setTrades(tradesData.trades || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Poll every 2 seconds as fallback
    const interval = setInterval(fetchData, 2000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // WebSocket connection
  const { isConnected } = useWebSocket(
    useCallback((message) => {
      if (message.type === 'agent_event' && message.event) {
        // Update state based on event type
        if (message.event.type === 'stateChange' || message.event.type === 'log') {
          fetchData();
        }
      } else if (message.type === 'initial_state' && message.data) {
        setAgentStatus((prev) => ({
          ...prev,
          state: message.data.state,
          isRunning: message.data.isRunning,
          portfolio: message.data.portfolio,
          wallet: message.data.wallet,
        } as AgentStatus));
      }
    }, [fetchData])
  );

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

  if (!agentStatus) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Connecting to Hound Agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              🐕 Hound AI Agent
            </h1>
            <p className="text-gray-400 mt-2">
              Autonomous Financial Trading Agent with Blockchain Execution
            </p>
          </div>

          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-gray-400">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {agentStatus.isRunning ? (
              <button
                onClick={handleStop}
                disabled={isStopping}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
              >
                {isStopping ? 'Stopping...' : '⏸ Stop Agent'}
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={isStarting}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
              >
                {isStarting ? 'Starting...' : '▶ Start Agent'}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-6">
        <AgentStatusPanel
          state={agentStatus.state}
          isRunning={agentStatus.isRunning}
          wallet={agentStatus.wallet}
        />

        <PortfolioPanel portfolio={agentStatus.portfolio} />

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

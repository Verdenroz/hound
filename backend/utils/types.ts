export enum AgentState {
  IDLE = 'idle',
  MONITORING = 'monitoring',
  ANALYZING = 'analyzing',
  DECIDING = 'deciding',
  RISK_CHECK = 'risk_check',
  EXECUTING = 'executing',
  EXPLAINING = 'explaining',
}

export interface Holding {
  ticker: string;
  shares: number;
  avg_price: number;
}

export interface Portfolio {
  holdings: Holding[];
  cash_balance: number;
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
}

export interface Trade {
  ticker: string;
  action: 'buy' | 'sell';
  shares: number;
  price: number;
  timestamp: number;
  xrpl_tx?: string;
  explorer_link?: string;
}

export interface NewsArticle {
  title: string;
  url: string;
  content: string;
  published_date?: string;
  score?: number;
}

export interface GeminiAnalysis {
  impact_score: number; // 1-10
  sentiment: 'bullish' | 'bearish' | 'neutral';
  action: 'buy' | 'sell' | 'hold';
  confidence: number; // 0-1
  amount_usd: number;
  reasoning: string;
}

export interface TradingDecision {
  action: 'buy' | 'sell';
  ticker: string;
  shares: number;
  amount_usd: number;
  price?: number; // Real-time stock price at decision time
  reasoning: string;
  xrpl_tx?: string;
  explorer_link?: string;
}

export interface AgentLog {
  timestamp: string;
  state: AgentState;
  message: string;
  data?: unknown;
}

export interface XRPLTransaction {
  hash: string;
  explorerLink: string;
}

export interface RiskCheckResult {
  sufficient_balance: boolean;
  position_limit: boolean;
  daily_trade_limit: boolean;
  passed: boolean;
}
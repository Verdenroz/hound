import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface User {
  id: string;
  auth0_sub: string;
  email: string; // Primary identifier
  name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Holding {
  id: string;
  user_id: string;
  ticker: string;
  shares: number;
  avg_price: number;
  created_at: string;
  updated_at: string;
}

export interface Portfolio {
  id: string;
  user_id: string;
  cash_balance: number;
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
  xrpl_wallet_address: string | null;
  xrpl_wallet_seed: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  ticker: string;
  action: 'buy' | 'sell';
  shares: number;
  price_per_share: number;
  total_amount: number;
  xrpl_tx_hash: string | null;
  xrpl_explorer_link: string | null;
  news_article_url: string | null;
  ai_reasoning: string | null;
  confidence_score: number | null;
  impact_score: number | null;
  executed_at: string;
}

export interface AgentSession {
  id: string;
  user_id: string;
  started_at: string;
  stopped_at: string | null;
  trades_count: number;
  status: 'active' | 'stopped';
}

// Helper functions for common queries
export async function getOrCreateUser(auth0Sub: string, email: string, name?: string) {
  // Check if user exists by email (primary identifier)
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (existingUser) {
    // Update auth0_sub and name if they've changed
    if (existingUser.auth0_sub !== auth0Sub || existingUser.name !== name) {
      const { data: updatedUser } = await supabase
        .from('users')
        .update({ auth0_sub: auth0Sub, name })
        .eq('email', email)
        .select()
        .single();

      return updatedUser as User;
    }
    return existingUser as User;
  }

  // Create new user (triggers auto-creation of empty portfolio via DB trigger)
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({ auth0_sub: auth0Sub, email, name })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return newUser as User;
}

export async function getUserPortfolio(userId: string) {
  const [portfolioRes, holdingsRes] = await Promise.all([
    supabase.from('portfolios').select('*').eq('user_id', userId).single(),
    supabase.from('holdings').select('*').eq('user_id', userId),
  ]);

  if (portfolioRes.error) throw portfolioRes.error;
  if (holdingsRes.error) throw holdingsRes.error;

  return {
    portfolio: portfolioRes.data as Portfolio,
    holdings: holdingsRes.data as Holding[],
  };
}

export async function getUserTrades(userId: string, limit: number = 50) {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('executed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Trade[];
}

export async function createTrade(trade: Omit<Trade, 'id' | 'executed_at'>) {
  const { data, error } = await supabase.from('trades').insert(trade).select().single();

  if (error) throw error;
  return data as Trade;
}

export async function updateHolding(
  userId: string,
  ticker: string,
  shares: number,
  avgPrice: number
) {
  const { data, error } = await supabase
    .from('holdings')
    .upsert(
      { user_id: userId, ticker, shares, avg_price: avgPrice },
      { onConflict: 'user_id,ticker' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as Holding;
}

export async function updateCashBalance(userId: string, newBalance: number) {
  const { data, error } = await supabase
    .from('portfolios')
    .update({ cash_balance: newBalance })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as Portfolio;
}

export async function startAgentSession(userId: string) {
  const { data, error } = await supabase
    .from('agent_sessions')
    .insert({ user_id: userId, status: 'active' })
    .select()
    .single();

  if (error) throw error;
  return data as AgentSession;
}

export async function stopAgentSession(sessionId: string, tradesCount: number) {
  const { data, error } = await supabase
    .from('agent_sessions')
    .update({ stopped_at: new Date().toISOString(), status: 'stopped', trades_count: tradesCount })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return data as AgentSession;
}

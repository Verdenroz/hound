import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Backend uses service role key for full access
let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Please configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }
  return supabase;
}

// Database types
export interface User {
  id: string;
  auth0_sub: string;
  email: string;
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

// Helper functions
export async function getOrCreateUser(auth0Sub: string, email: string, name?: string) {
  const client = getSupabase();

  // Check if user exists
  const { data: existingUser } = await client
    .from('users')
    .select('*')
    .eq('auth0_sub', auth0Sub)
    .single();

  if (existingUser) {
    return existingUser as User;
  }

  // Create new user (triggers auto-creation of portfolio and default holdings)
  const { data: newUser, error } = await client
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
  const client = getSupabase();

  const [portfolioRes, holdingsRes] = await Promise.all([
    client.from('portfolios').select('*').eq('user_id', userId).single(),
    client.from('holdings').select('*').eq('user_id', userId),
  ]);

  if (portfolioRes.error) throw portfolioRes.error;
  if (holdingsRes.error) throw holdingsRes.error;

  return {
    portfolio: portfolioRes.data as Portfolio,
    holdings: holdingsRes.data as Holding[],
  };
}

export async function getUserTrades(userId: string, limit: number = 50) {
  const client = getSupabase();

  const { data, error } = await client
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('executed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Trade[];
}

export async function createTrade(trade: Omit<Trade, 'id' | 'executed_at'>) {
  const client = getSupabase();

  const { data, error } = await client.from('trades').insert(trade).select().single();

  if (error) throw error;
  return data as Trade;
}

export async function updateHolding(
  userId: string,
  ticker: string,
  shares: number,
  avgPrice: number
) {
  const client = getSupabase();

  const { data, error } = await client
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
  const client = getSupabase();

  const { data, error } = await client
    .from('portfolios')
    .update({ cash_balance: newBalance })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as Portfolio;
}

export async function startAgentSession(userId: string) {
  const client = getSupabase();

  const { data, error } = await client
    .from('agent_sessions')
    .insert({ user_id: userId, status: 'active' })
    .select()
    .single();

  if (error) throw error;
  return data as AgentSession;
}

export async function stopAgentSession(sessionId: string, tradesCount: number) {
  const client = getSupabase();

  const { data, error } = await client
    .from('agent_sessions')
    .update({ stopped_at: new Date().toISOString(), status: 'stopped', trades_count: tradesCount })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return data as AgentSession;
}

export async function updateWalletAddress(userId: string, address: string, seed: string) {
  const client = getSupabase();

  const { data, error } = await client
    .from('portfolios')
    .update({ xrpl_wallet_address: address, xrpl_wallet_seed: seed })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as Portfolio;
}

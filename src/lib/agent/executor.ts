// Stateless Agent Executor for Next.js
// Executes one agent cycle per invocation, stores state in Supabase

import { TavilyService } from '../services/tavily';
import { GeminiService } from '../services/gemini';
import { XRPLService } from '../services/xrpl';
import { AgentState, NewsArticle, GeminiAnalysis, TradingDecision } from './types';
import { createClient } from '@supabase/supabase-js';

export interface AgentStateData {
  state: AgentState;
  is_running: boolean;
  wallet_address: string | null;
  current_news: NewsArticle[] | null;
  current_analysis: GeminiAnalysis | null;
  current_decision: TradingDecision | null;
}

export class AgentExecutor {
  private tavily: TavilyService;
  private gemini: GeminiService;
  private xrpl: XRPLService;
  private supabase: ReturnType<typeof createClient>;

  constructor(
    tavilyApiKey: string,
    geminiApiKey: string,
    walletSeed: string | undefined,
    supabaseUrl: string,
    supabaseServiceKey: string
  ) {
    this.tavily = new TavilyService(tavilyApiKey);
    this.gemini = new GeminiService(geminiApiKey);
    this.xrpl = new XRPLService(walletSeed);
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Initialize the agent for a user
   */
  async initialize(userId: string): Promise<void> {
    await this.xrpl.initialize();

    // Create or get agent state
    const { data: existingState } = await this.supabase
      .from('agent_state')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!existingState) {
      await this.supabase.from('agent_state').insert({
        user_id: userId,
        state: AgentState.IDLE,
        is_running: false,
        wallet_address: this.xrpl.getWalletAddress(),
      });
    }
  }

  /**
   * Execute one agent cycle
   */
  async executeCycle(userId: string): Promise<AgentStateData> {
    // Get current state
    const { data: stateData } = await this.supabase
      .from('agent_state')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!stateData || !stateData.is_running) {
      return {
        state: AgentState.IDLE,
        is_running: false,
        wallet_address: null,
        current_news: null,
        current_analysis: null,
        current_decision: null,
      };
    }

    const currentState = stateData.state as AgentState;

    // Execute state machine logic
    let newState = currentState;
    let newsArticles = stateData.current_news;
    let analysis = stateData.current_analysis;
    let decision = stateData.current_decision;

    try {
      switch (currentState) {
        case AgentState.IDLE:
          // Transition to SEARCHING
          newState = AgentState.SEARCHING;
          await this.logEvent(userId, 'State changed to SEARCHING');
          break;

        case AgentState.SEARCHING:
          // Search for news
          await this.logEvent(userId, 'Searching for financial news...');
          newsArticles = await this.tavily.searchFinancialNews();
          newState = AgentState.ANALYZING;
          await this.logEvent(userId, `Found ${newsArticles.length} articles`);
          break;

        case AgentState.ANALYZING:
          // Analyze news with Gemini
          if (newsArticles && newsArticles.length > 0) {
            await this.logEvent(userId, 'Analyzing news with AI...');
            analysis = await this.gemini.analyzeNews(newsArticles);
            newState = AgentState.DECIDING;
            await this.logEvent(userId, 'Analysis complete');
          } else {
            newState = AgentState.IDLE;
          }
          break;

        case AgentState.DECIDING:
          // Make trading decision
          if (analysis) {
            await this.logEvent(userId, 'Making trading decision...');
            // Get user's portfolio
            const { data: portfolio } = await this.supabase
              .from('portfolios')
              .select('*')
              .eq('user_id', userId)
              .single();

            const { data: holdings } = await this.supabase
              .from('holdings')
              .select('*')
              .eq('user_id', userId);

            decision = await this.gemini.makeDecision(analysis, {
              holdings: holdings || [],
              cash_balance: portfolio?.cash_balance || 5000,
              risk_tolerance: portfolio?.risk_tolerance || 'moderate',
            });
            newState = AgentState.EXECUTING;
            await this.logEvent(userId, `Decision: ${decision.action} ${decision.ticker}`);
          } else {
            newState = AgentState.IDLE;
          }
          break;

        case AgentState.EXECUTING:
          // Execute trade
          if (decision && decision.action !== 'hold') {
            await this.logEvent(userId, `Executing ${decision.action} order...`);

            // Create trade record
            await this.supabase.from('trades').insert({
              user_id: userId,
              ticker: decision.ticker,
              action: decision.action,
              shares: decision.shares,
              price_per_share: decision.price,
              total_amount: decision.shares * decision.price,
              ai_reasoning: decision.reasoning,
              confidence_score: decision.confidence,
            });

            // Update holdings
            if (decision.action === 'buy') {
              await this.supabase.from('holdings').upsert({
                user_id: userId,
                ticker: decision.ticker,
                shares: decision.shares,
                avg_price: decision.price,
              }, { onConflict: 'user_id,ticker' });

              // Update cash balance
              const newBalance = (stateData.cash_balance || 5000) - (decision.shares * decision.price);
              await this.supabase.from('portfolios').update({
                cash_balance: newBalance,
              }).eq('user_id', userId);
            }

            await this.logEvent(userId, 'Trade executed successfully');
          }
          newState = AgentState.IDLE;
          break;
      }

      // Update state in database
      await this.supabase
        .from('agent_state')
        .update({
          state: newState,
          current_news: newsArticles,
          current_analysis: analysis,
          current_decision: decision,
          last_cycle_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      return {
        state: newState,
        is_running: stateData.is_running,
        wallet_address: stateData.wallet_address,
        current_news: newsArticles,
        current_analysis: analysis,
        current_decision: decision,
      };
    } catch (error) {
      console.error('Agent cycle error:', error);
      await this.logEvent(userId, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');

      // Reset to IDLE on error
      await this.supabase
        .from('agent_state')
        .update({ state: AgentState.IDLE })
        .eq('user_id', userId);

      throw error;
    }
  }

  /**
   * Start the agent
   */
  async start(userId: string, sessionId?: string): Promise<void> {
    await this.supabase
      .from('agent_state')
      .update({
        is_running: true,
        state: AgentState.IDLE,
        session_id: sessionId,
      })
      .eq('user_id', userId);

    await this.logEvent(userId, 'Agent started', 'info');
  }

  /**
   * Stop the agent
   */
  async stop(userId: string): Promise<void> {
    await this.supabase
      .from('agent_state')
      .update({
        is_running: false,
        state: AgentState.IDLE,
      })
      .eq('user_id', userId);

    await this.logEvent(userId, 'Agent stopped', 'info');
  }

  /**
   * Get agent status
   */
  async getStatus(userId: string): Promise<AgentStateData> {
    const { data } = await this.supabase
      .from('agent_state')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!data) {
      return {
        state: AgentState.IDLE,
        is_running: false,
        wallet_address: null,
        current_news: null,
        current_analysis: null,
        current_decision: null,
      };
    }

    return {
      state: data.state as AgentState,
      is_running: data.is_running,
      wallet_address: data.wallet_address,
      current_news: data.current_news,
      current_analysis: data.current_analysis,
      current_decision: data.current_decision,
    };
  }

  /**
   * Log an event
   */
  private async logEvent(userId: string, message: string, level: 'info' | 'warn' | 'error' = 'info'): Promise<void> {
    const { data: state } = await this.supabase
      .from('agent_state')
      .select('session_id')
      .eq('user_id', userId)
      .single();

    await this.supabase.from('agent_logs').insert({
      user_id: userId,
      session_id: state?.session_id,
      level,
      message,
    });

    await this.supabase.from('agent_events').insert({
      user_id: userId,
      session_id: state?.session_id,
      event_type: 'log',
      data: { level, message },
    });
  }
}

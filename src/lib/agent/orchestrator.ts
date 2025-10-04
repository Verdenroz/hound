import { Wallet } from 'xrpl';
import { AgentState, NewsArticle, GeminiAnalysis, TradingDecision, AgentLog } from '../utils/types';
import { TavilyService } from '../services/tavily';
import { GeminiService } from '../services/gemini';
import { XRPLService } from '../services/xrpl';
import { PortfolioService } from '../services/portfolio';
import { Logger } from '../utils/logger';

export interface AgentEvent {
  type: 'log' | 'stateChange' | 'tradeComplete' | 'error';
  data: any;
  timestamp: number;
}

export class AgentOrchestrator {
  private state: AgentState = AgentState.IDLE;
  private tavily: TavilyService;
  private gemini: GeminiService;
  private xrpl: XRPLService;
  private portfolio: PortfolioService;
  private logger: Logger;

  private wallet: Wallet | null = null;
  private isRunning: boolean = false;

  private currentNews: (NewsArticle & { ticker?: string }) | null = null;
  private currentAnalysis: (GeminiAnalysis & { ticker: string; news: NewsArticle }) | null = null;
  private currentDecision: TradingDecision | null = null;

  private events: AgentEvent[] = [];
  private eventCallbacks: ((event: AgentEvent) => void)[] = [];

  private walletSeed?: string;

  constructor(
    tavilyApiKey: string,
    geminiApiKey: string,
    walletSeed?: string
  ) {
    this.tavily = new TavilyService(tavilyApiKey);
    this.gemini = new GeminiService(geminiApiKey);
    this.xrpl = new XRPLService();
    this.portfolio = new PortfolioService();
    this.logger = new Logger();
    this.walletSeed = walletSeed;
  }

  async initialize(): Promise<void> {
    await this.xrpl.connect();

    if (this.walletSeed) {
      this.wallet = await this.xrpl.getWalletFromSeed(this.walletSeed);
      this.log('Using existing wallet', { address: this.wallet.address });
    } else {
      this.log('Creating new XRPL wallet...');
      this.wallet = await this.xrpl.createWallet();
      this.log('Wallet created', { address: this.wallet.address, seed: this.wallet.seed });
    }

    // Set up RLUSD trustline (required to hold/receive RLUSD tokens)
    this.log('Setting up RLUSD trustline for stablecoin transactions...');
    await this.xrpl.setupRLUSDTrustline(this.wallet);

    // Check balances
    const xrpBalance = await this.xrpl.getBalance(this.wallet.address);
    const rlusdBalance = await this.xrpl.getRLUSDBalance(this.wallet.address);

    this.log('Wallet balances', {
      xrp: xrpBalance,
      rlusd: rlusdBalance,
      address: this.wallet.address
    });

    this.log('Agent initialized successfully - Ready for RLUSD-based trading');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Agent is already running');
      return;
    }

    this.isRunning = true;
    this.setState(AgentState.MONITORING);
    this.log('🚀 Agent starting autonomous operation');

    this.run().catch((error) => {
      console.error('Fatal agent error:', error);
      this.isRunning = false;
    });
  }

  stop(): void {
    this.isRunning = false;
    this.setState(AgentState.IDLE);
    this.log('🛑 Agent stopped');
  }

  private async run(): Promise<void> {
    while (this.isRunning) {
      try {
        switch (this.state) {
          case AgentState.IDLE:
            await this.sleep(5000);
            break;

          case AgentState.MONITORING:
            await this.monitorNews();
            break;

          case AgentState.ANALYZING:
            await this.analyzeNews();
            break;

          case AgentState.DECIDING:
            await this.makeDecision();
            break;

          case AgentState.RISK_CHECK:
            await this.checkRisk();
            break;

          case AgentState.EXECUTING:
            await this.executeTrade();
            break;

          case AgentState.EXPLAINING:
            await this.explainDecision();
            break;
        }

        await this.sleep(1000);
      } catch (error: any) {
        this.log('Error in agent loop', { error: error.message });
        this.emitEvent('error', { message: error.message, state: this.state });
        this.setState(AgentState.MONITORING);
        await this.sleep(5000);
      }
    }
  }

  private async monitorNews(): Promise<void> {
    this.log('👀 Monitoring financial news...');

    const tickers = this.portfolio.getTickers();
    const news = await this.tavily.monitorPortfolio(tickers);

    if (news && news.length > 0) {
      // Filter for high-relevance news
      const relevantNews = this.tavily.filterRelevantNews(news, tickers);

      if (relevantNews.length > 0) {
        // Find the most impactful news
        const sortedNews = relevantNews.sort((a, b) => (b.score || 0) - (a.score || 0));
        this.currentNews = sortedNews[0];

        this.log('📰 Relevant news detected', {
          title: this.currentNews.title,
          url: this.currentNews.url,
          score: this.currentNews.score,
        });

        this.setState(AgentState.ANALYZING);
      } else {
        this.log('No relevant news found, continuing to monitor');
        await this.sleep(30000); // Wait 30 seconds
      }
    } else {
      this.log('No news found, waiting...');
      await this.sleep(30000);
    }
  }

  private async analyzeNews(): Promise<void> {
    if (!this.currentNews) {
      this.setState(AgentState.MONITORING);
      return;
    }

    this.log('🤖 Analyzing news impact with Gemini AI...');

    // Determine which ticker this affects most
    const tickers = this.portfolio.getTickers();
    const affectedTicker = this.findMostAffectedTicker(this.currentNews.content, tickers);

    if (!affectedTicker) {
      this.log('Could not determine affected ticker');
      this.setState(AgentState.MONITORING);
      this.currentNews = null;
      return;
    }

    this.currentNews.ticker = affectedTicker;

    // Get full article content if needed
    let fullContent = this.currentNews.content;
    if (fullContent.length < 200) {
      this.log('Extracting full article content...');
      const extracted = await this.tavily.extractArticle(this.currentNews.url);
      if (extracted) {
        fullContent = extracted.content;
      }
    }

    // Analyze with Gemini
    const analysis = await this.gemini.analyzeNewsImpact(
      fullContent,
      affectedTicker,
      this.portfolio.getHoldings()
    );

    this.currentAnalysis = {
      ...analysis,
      ticker: affectedTicker,
      news: this.currentNews,
    };

    this.log('✅ Analysis complete', {
      ticker: affectedTicker,
      impact: analysis.impact_score,
      sentiment: analysis.sentiment,
      action: analysis.action,
      confidence: analysis.confidence,
    });

    // Decide if action is needed
    if (analysis.impact_score >= 7 && analysis.confidence >= 0.75 && analysis.action !== 'hold') {
      this.setState(AgentState.DECIDING);
    } else {
      this.log('Impact not significant enough for action', {
        impact: analysis.impact_score,
        confidence: analysis.confidence,
        action: analysis.action,
      });
      this.setState(AgentState.MONITORING);
      this.currentNews = null;
      this.currentAnalysis = null;
    }
  }

  private async makeDecision(): Promise<void> {
    if (!this.currentAnalysis) {
      this.setState(AgentState.MONITORING);
      return;
    }

    this.log('💭 Making trading decision...');

    const { action, amount_usd, reasoning, ticker } = this.currentAnalysis;

    // Calculate shares (using mock price of $100 for demo)
    const mockPrice = 100;
    const shares = Math.floor(amount_usd / mockPrice);

    this.currentDecision = {
      action: action as 'buy' | 'sell',
      ticker,
      shares,
      amount_usd,
      reasoning,
    };

    this.log('✅ Decision made', this.currentDecision);
    this.setState(AgentState.RISK_CHECK);
  }

  private async checkRisk(): Promise<void> {
    if (!this.currentDecision) {
      this.setState(AgentState.MONITORING);
      return;
    }

    this.log('🛡️ Performing risk checks...');

    const { action, ticker, amount_usd } = this.currentDecision;

    const riskResult = this.portfolio.checkRisk(action, ticker, amount_usd);

    this.log('Risk check result', riskResult);

    if (riskResult.passed) {
      this.log('✅ Risk checks passed, proceeding to execution');
      this.setState(AgentState.EXECUTING);
    } else {
      this.log('❌ Risk check failed, aborting trade', {
        sufficient_balance: riskResult.sufficient_balance,
        position_limit: riskResult.position_limit,
        daily_trade_limit: riskResult.daily_trade_limit,
      });
      this.setState(AgentState.MONITORING);
      this.currentNews = null;
      this.currentAnalysis = null;
      this.currentDecision = null;
    }
  }

  private async executeTrade(): Promise<void> {
    if (!this.currentDecision || !this.wallet) {
      this.setState(AgentState.MONITORING);
      return;
    }

    this.log('⚡ Executing trade on XRPL blockchain...');

    const { action, ticker, shares, amount_usd } = this.currentDecision;
    const mockPrice = 100;

    try {
      // Execute on XRPL
      const xrplResult = await this.xrpl.executeTrade(
        this.wallet,
        action,
        ticker,
        amount_usd
      );

      // Update portfolio
      const success = this.portfolio.executeTrade(ticker, action, shares, mockPrice);

      if (success) {
        this.currentDecision.xrpl_tx = xrplResult.hash;
        this.currentDecision.explorer_link = xrplResult.explorerLink;

        this.log('✅ Trade executed successfully', {
          hash: xrplResult.hash,
          link: xrplResult.explorerLink,
        });

        this.setState(AgentState.EXPLAINING);
      } else {
        throw new Error('Portfolio update failed');
      }
    } catch (error: any) {
      this.log('❌ Trade execution failed', { error: error.message });
      this.setState(AgentState.MONITORING);
      this.currentNews = null;
      this.currentAnalysis = null;
      this.currentDecision = null;
    }
  }

  private async explainDecision(): Promise<void> {
    if (!this.currentNews || !this.currentAnalysis || !this.currentDecision) {
      this.setState(AgentState.MONITORING);
      return;
    }

    this.log('📝 Generating explanation...');

    const explanation = await this.gemini.explainDecision(
      this.currentNews,
      this.currentAnalysis,
      this.currentDecision
    );

    this.log('Explanation generated', { explanation });

    // Emit complete trade event
    this.emitEvent('tradeComplete', {
      news: this.currentNews,
      analysis: this.currentAnalysis,
      decision: this.currentDecision,
      explanation,
    });

    // Reset and continue monitoring
    this.currentNews = null;
    this.currentAnalysis = null;
    this.currentDecision = null;

    this.setState(AgentState.MONITORING);
  }

  private findMostAffectedTicker(content: string, tickers: string[]): string | null {
    const contentLower = content.toLowerCase();
    let maxMentions = 0;
    let affectedTicker: string | null = null;

    for (const ticker of tickers) {
      const mentions = (contentLower.match(new RegExp(ticker.toLowerCase(), 'g')) || []).length;
      if (mentions > maxMentions) {
        maxMentions = mentions;
        affectedTicker = ticker;
      }
    }

    return maxMentions > 0 ? affectedTicker : null;
  }

  private setState(newState: AgentState): void {
    const oldState = this.state;
    this.state = newState;
    this.log(`State transition: ${oldState} → ${newState}`);
    this.emitEvent('stateChange', { oldState, newState });
  }

  private log(message: string, data?: any): void {
    const logEntry = this.logger.log(this.state, message, data);
    this.emitEvent('log', logEntry);
  }

  private emitEvent(type: AgentEvent['type'], data: any): void {
    const event: AgentEvent = {
      type,
      data,
      timestamp: Date.now(),
    };

    this.events.push(event);

    // Keep only last 100 events
    if (this.events.length > 100) {
      this.events.shift();
    }

    // Notify callbacks
    this.eventCallbacks.forEach((callback) => callback(event));
  }

  onEvent(callback: (event: AgentEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Public getters for API
  getState(): AgentState {
    return this.state;
  }

  getLogs(limit?: number): AgentLog[] {
    return this.logger.getLogs(limit);
  }

  getPortfolio() {
    return this.portfolio.getPortfolio();
  }

  getTradeHistory(limit?: number) {
    return this.portfolio.getTradeHistory(limit);
  }

  getCurrentNews() {
    return this.currentNews;
  }

  getCurrentAnalysis() {
    return this.currentAnalysis;
  }

  getCurrentDecision() {
    return this.currentDecision;
  }

  getWalletAddress(): string | null {
    return this.wallet?.address || null;
  }

  getEvents(): AgentEvent[] {
    return [...this.events];
  }

  isAgentRunning(): boolean {
    return this.isRunning;
  }

  async shutdown(): Promise<void> {
    this.stop();
    await this.xrpl.disconnect();
    this.log('Agent shutdown complete');
  }
}

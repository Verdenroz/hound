import { Wallet } from 'xrpl';
import { AgentState, NewsArticle, GeminiAnalysis, TradingDecision, AgentLog } from '../utils/types';
import { TavilyService } from '../services/tavily';
import { GeminiService } from '../services/gemini';
import { XRPLService } from '../services/xrpl';
import { redis } from '../services/redis';
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
  private userEmail: string;
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
    userEmail: string,
    tavilyApiKey: string,
    geminiApiKey: string,
    walletSeed?: string
  ) {
    this.userEmail = userEmail;
    this.tavily = new TavilyService(tavilyApiKey);
    this.gemini = new GeminiService(geminiApiKey);
    this.xrpl = new XRPLService();
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

    const portfolio = await redis.getPortfolio(this.userEmail);
    if (!portfolio) {
      this.log('No portfolio configured, waiting...');
      await this.sleep(30000);
      return;
    }

    const tickers = portfolio.holdings.map(h => h.ticker);
    const news = await this.tavily.monitorPortfolio(tickers);

    if (news && news.length > 0) {
      // Filter for high-relevance news
      const relevantNews = this.tavily.filterRelevantNews(news, tickers);

      if (relevantNews.length > 0) {
        // Find the most impactful news that hasn't been processed recently
        const sortedNews = relevantNews.sort((a, b) => (b.score || 0) - (a.score || 0));

        // Check for unprocessed news
        let unprocessedNews = null;
        for (const article of sortedNews) {
          const alreadyProcessed = await redis.hasProcessedNews(this.userEmail, article.url);
          if (!alreadyProcessed) {
            unprocessedNews = article;
            break;
          }
        }

        if (!unprocessedNews) {
          this.log('All relevant news already processed, waiting for new articles');
          await this.sleep(30000);
          return;
        }

        this.currentNews = unprocessedNews;

        this.log('📰 Relevant news detected', {
          title: this.currentNews.title,
          url: this.currentNews.url,
          score: this.currentNews.score,
        });

        // Mark as processed immediately to prevent duplicate processing
        await redis.markNewsAsProcessed(this.userEmail, this.currentNews.url).catch(err => {
          console.error('Failed to mark news as processed:', err);
        });

        // Persist news to Redis for historical tracking
        await redis.addNews(this.userEmail, this.currentNews).catch(err => {
          console.error('Failed to save news to Redis:', err);
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

    const portfolio = await redis.getPortfolio(this.userEmail);
    if (!portfolio) {
      this.log('No portfolio configured');
      this.setState(AgentState.MONITORING);
      this.currentNews = null;
      return;
    }

    // Determine which ticker this affects most
    const tickers = portfolio.holdings.map(h => h.ticker);
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
      portfolio.holdings
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

    const portfolio = await redis.getPortfolio(this.userEmail);
    if (!portfolio) {
      this.log('❌ No portfolio configured');
      this.setState(AgentState.MONITORING);
      this.currentNews = null;
      this.currentAnalysis = null;
      this.currentDecision = null;
      return;
    }

    const riskResult = {
      sufficient_balance: true,
      position_limit: true,
      daily_trade_limit: true,
      passed: true,
    };

    // Check 1: Sufficient balance for buy orders
    if (action === 'buy') {
      riskResult.sufficient_balance = portfolio.cash_balance >= amount_usd;

      // Check 2: Position limit (max 30% in single stock)
      const currentHolding = portfolio.holdings.find(h => h.ticker === ticker);
      const currentHoldingValue = currentHolding ? currentHolding.shares * currentHolding.avg_price : 0;
      const totalHoldingsValue = portfolio.holdings.reduce((sum, h) => sum + h.shares * h.avg_price, 0);
      const totalValue = totalHoldingsValue + portfolio.cash_balance;

      const newExposure = totalValue > 0
        ? ((currentHoldingValue + amount_usd) / totalValue) * 100
        : (amount_usd / (portfolio.cash_balance + amount_usd)) * 100;

      riskResult.position_limit = newExposure <= 30; // Max 30% in single position
    }

    // Check 3: Daily trade limit (max 3 trades per day)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const trades = await redis.getTrades(this.userEmail, 100);
    const todayTrades = trades.filter((t: any) => t.timestamp > oneDayAgo);
    riskResult.daily_trade_limit = todayTrades.length < 3;

    // Overall result
    riskResult.passed =
      riskResult.sufficient_balance &&
      riskResult.position_limit &&
      riskResult.daily_trade_limit;

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

      // Update portfolio in Redis
      const portfolio = await redis.getPortfolio(this.userEmail);
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }

      if (action === 'buy') {
        // Deduct cash
        await redis.updatePortfolio(this.userEmail, {
          cash_balance: portfolio.cash_balance - amount_usd,
        });

        // Update or create holding
        const existingHolding = portfolio.holdings.find(h => h.ticker === ticker);
        if (existingHolding) {
          const totalShares = existingHolding.shares + shares;
          const totalCost = existingHolding.shares * existingHolding.avg_price + amount_usd;
          await redis.updateHolding(this.userEmail, ticker, totalShares, totalCost / totalShares);
        } else {
          await redis.addHolding(this.userEmail, ticker, shares, mockPrice);
        }

        this.log(`✅ BUY: ${shares} shares of ${ticker} @ $${mockPrice}`);
      } else if (action === 'sell') {
        const holding = portfolio.holdings.find(h => h.ticker === ticker);
        if (!holding || holding.shares < shares) {
          throw new Error(`Insufficient shares: Need ${shares}, have ${holding?.shares || 0}`);
        }

        // Add cash
        await redis.updatePortfolio(this.userEmail, {
          cash_balance: portfolio.cash_balance + amount_usd,
        });

        // Update or remove holding
        if (holding.shares === shares) {
          await redis.removeHolding(this.userEmail, ticker);
        } else {
          await redis.updateHolding(this.userEmail, ticker, holding.shares - shares);
        }

        this.log(`✅ SELL: ${shares} shares of ${ticker} @ $${mockPrice}`);
      }

      // Record trade
      await redis.addTrade(this.userEmail, {
        ticker,
        action,
        shares,
        price: mockPrice,
        xrpl_tx: xrplResult.hash,
        explorer_link: xrplResult.explorerLink,
      });

      this.currentDecision.xrpl_tx = xrplResult.hash;
      this.currentDecision.explorer_link = xrplResult.explorerLink;

      this.log('✅ Trade executed successfully', {
        hash: xrplResult.hash,
        link: xrplResult.explorerLink,
      });

      this.setState(AgentState.EXPLAINING);
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

    // Save log to Redis asynchronously
    redis.addLog(this.userEmail, logEntry).catch(err => {
      console.error('Failed to save log to Redis:', err);
    });
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

    // Save event to Redis asynchronously
    redis.addEvent(this.userEmail, event).catch(err => {
      console.error('Failed to save event to Redis:', err);
    });

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

  async getPortfolio() {
    return await redis.getPortfolio(this.userEmail);
  }

  async getTradeHistory(limit?: number) {
    return await redis.getTrades(this.userEmail, limit || 50);
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
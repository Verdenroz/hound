import { Portfolio, Holding, Trade, RiskCheckResult } from '../utils/types';
import * as fs from 'fs';
import * as path from 'path';

export class PortfolioService {
  private portfolio: Portfolio;
  private tradeHistory: Trade[] = [];
  private portfolioPath: string;

  constructor(portfolioPath?: string) {
    this.portfolioPath =
      portfolioPath || path.join(__dirname, '../config/portfolio.json');
    this.loadPortfolio();
  }

  private loadPortfolio(): void {
    try {
      const data = fs.readFileSync(this.portfolioPath, 'utf-8');
      this.portfolio = JSON.parse(data);
      console.log('📊 Portfolio loaded successfully');
    } catch (error) {
      console.error('Failed to load portfolio:', error);
      throw error;
    }
  }

  private savePortfolio(): void {
    try {
      fs.writeFileSync(
        this.portfolioPath,
        JSON.stringify(this.portfolio, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save portfolio:', error);
    }
  }

  getPortfolio(): Portfolio {
    return { ...this.portfolio };
  }

  getHoldings(): Holding[] {
    return [...this.portfolio.holdings];
  }

  getTickers(): string[] {
    return this.portfolio.holdings.map((h) => h.ticker);
  }

  getHolding(ticker: string): Holding | undefined {
    return this.portfolio.holdings.find((h) => h.ticker === ticker);
  }

  getTotalValue(): number {
    const holdingsValue = this.portfolio.holdings.reduce((sum, h) => {
      return sum + h.shares * h.avg_price;
    }, 0);
    return holdingsValue + this.portfolio.cash_balance;
  }

  getExposure(ticker: string): number {
    const holding = this.getHolding(ticker);
    if (!holding) return 0;

    const holdingValue = holding.shares * holding.avg_price;
    const totalValue = this.getTotalValue();

    return totalValue > 0 ? (holdingValue / totalValue) * 100 : 0;
  }

  canAffordTrade(amount: number): boolean {
    return this.portfolio.cash_balance >= amount;
  }

  executeTrade(
    ticker: string,
    action: 'buy' | 'sell',
    shares: number,
    price: number
  ): boolean {
    const holding = this.getHolding(ticker);
    const amount = shares * price;

    if (action === 'buy') {
      if (!this.canAffordTrade(amount)) {
        console.error(`❌ Insufficient funds: Need $${amount}, have $${this.portfolio.cash_balance}`);
        return false;
      }

      this.portfolio.cash_balance -= amount;

      if (holding) {
        // Update existing holding
        const totalShares = holding.shares + shares;
        const totalCost = holding.shares * holding.avg_price + amount;
        holding.shares = totalShares;
        holding.avg_price = totalCost / totalShares;
      } else {
        // Create new holding
        this.portfolio.holdings.push({
          ticker,
          shares,
          avg_price: price,
        });
      }

      console.log(`✅ BUY: ${shares} shares of ${ticker} @ $${price}`);
    } else if (action === 'sell') {
      if (!holding || holding.shares < shares) {
        console.error(`❌ Insufficient shares: Need ${shares}, have ${holding?.shares || 0}`);
        return false;
      }

      const proceeds = amount;
      holding.shares -= shares;
      this.portfolio.cash_balance += proceeds;

      if (holding.shares === 0) {
        // Remove holding if all shares sold
        this.portfolio.holdings = this.portfolio.holdings.filter(
          (h) => h.ticker !== ticker
        );
      }

      console.log(`✅ SELL: ${shares} shares of ${ticker} @ $${price}`);
    }

    // Record trade in history
    const trade: Trade = {
      ticker,
      action,
      shares,
      price,
      timestamp: Date.now(),
    };
    this.tradeHistory.push(trade);

    // Save portfolio to disk
    this.savePortfolio();

    return true;
  }

  checkRisk(
    action: 'buy' | 'sell',
    ticker: string,
    amountUSD: number
  ): RiskCheckResult {
    const result: RiskCheckResult = {
      sufficient_balance: true,
      position_limit: true,
      daily_trade_limit: true,
      passed: true,
    };

    // Check 1: Sufficient balance for buy orders
    if (action === 'buy') {
      result.sufficient_balance = this.canAffordTrade(amountUSD);

      // Check 2: Position limit (max 30% in single stock)
      const currentExposure = this.getExposure(ticker);
      const totalValue = this.getTotalValue();
      const newExposure =
        totalValue > 0
          ? currentExposure + (amountUSD / totalValue) * 100
          : (amountUSD / (this.portfolio.cash_balance + amountUSD)) * 100;

      result.position_limit = newExposure <= 30; // Max 30% in single position
    }

    // Check 3: Daily trade limit (max 3 trades per day)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const todayTrades = this.tradeHistory.filter((t) => t.timestamp > oneDayAgo);
    result.daily_trade_limit = todayTrades.length < 3;

    // Overall result
    result.passed =
      result.sufficient_balance &&
      result.position_limit &&
      result.daily_trade_limit;

    return result;
  }

  getTradeHistory(limit?: number): Trade[] {
    if (limit) {
      return this.tradeHistory.slice(-limit);
    }
    return [...this.tradeHistory];
  }

  reset(): void {
    this.loadPortfolio();
    this.tradeHistory = [];
    console.log('🔄 Portfolio reset to initial state');
  }
}
import axios from 'axios';

interface SimpleQuote {
  symbol: string;
  name: string;
  price: string;
  preMarketPrice?: string;
  afterHoursPrice?: string;
  change: string;
  percentChange: string;
  logo?: string;
}

export class FinanceService {
  private baseUrl: string = 'https://finance-query.onrender.com/v1';

  /**
   * Get real-time stock price for a single ticker
   * Uses finance-query API simple-quotes endpoint
   */
  async getStockPrice(ticker: string): Promise<number> {
    try {
      const response = await axios.get<SimpleQuote[]>(
        `${this.baseUrl}/simple-quotes`,
        {
          params: { symbols: ticker },
        }
      );

      if (response.data.length === 0) {
        throw new Error(`No price data found for ${ticker}`);
      }

      const quote = response.data[0];
      const price = parseFloat(quote.price);

      if (isNaN(price) || price <= 0) {
        throw new Error(`Invalid price data for ${ticker}: ${quote.price}`);
      }

      console.log(`💰 Real-time price for ${ticker}: $${price}`);
      return price;
    } catch (error: any) {
      console.error(`❌ Failed to fetch price for ${ticker}:`, error.message);
      throw new Error(`Failed to fetch stock price for ${ticker}`);
    }
  }

  /**
   * Get real-time stock prices for multiple tickers
   * Uses finance-query API simple-quotes endpoint
   */
  async getStockPrices(tickers: string[]): Promise<Map<string, number>> {
    try {
      const response = await axios.get<SimpleQuote[]>(
        `${this.baseUrl}/simple-quotes`,
        {
          params: { symbols: tickers.join(',') },
        }
      );

      const prices = new Map<string, number>();

      for (const quote of response.data) {
        const price = parseFloat(quote.price);
        if (!isNaN(price) && price > 0) {
          prices.set(quote.symbol, price);
        }
      }

      console.log(`💰 Fetched ${prices.size} real-time prices`);
      return prices;
    } catch (error: any) {
      console.error('❌ Failed to fetch stock prices:', error.message);
      throw new Error('Failed to fetch stock prices');
    }
  }

  /**
   * Get full quote data including pre/post market prices
   */
  async getQuote(ticker: string): Promise<SimpleQuote | null> {
    try {
      const response = await axios.get<SimpleQuote[]>(
        `${this.baseUrl}/simple-quotes`,
        {
          params: { symbols: ticker },
        }
      );

      if (response.data.length === 0) {
        return null;
      }

      return response.data[0];
    } catch (error: any) {
      console.error(`❌ Failed to fetch quote for ${ticker}:`, error.message);
      return null;
    }
  }
}

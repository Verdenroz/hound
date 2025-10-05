import axios from 'axios';
import { NewsArticle } from '../utils/types';

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

interface TavilySearchResponse {
  results: TavilySearchResult[];
  answer?: string;
}

interface TavilyExtractResult {
  url: string;
  raw_content: string;
}

interface TavilyExtractResponse {
  results: TavilyExtractResult[];
}

export class TavilyService {
  private apiKey: string;
  private baseUrl: string = 'https://api.tavily.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Search for financial news using Tavily's Search endpoint
   * Satisfies Tavily sponsor challenge requirement: Search endpoint
   */
  async searchFinancialNews(
    query: string,
    maxResults: number = 5
  ): Promise<NewsArticle[]> {
    try {
      const response = await axios.post<TavilySearchResponse>(
        `${this.baseUrl}/search`,
        {
          api_key: this.apiKey,
          query: `${query} stock market financial news`,
          search_depth: 'advanced',
          max_results: maxResults,
          include_domains: [
            'reuters.com',
            'bloomberg.com',
            'cnbc.com',
            'marketwatch.com',
            'finance.yahoo.com',
            'wsj.com',
          ],
          include_answer: true,
          include_raw_content: false,
        }
      );

      console.log(`🔍 Tavily Search: Found ${response.data.results.length} articles for "${query}"`);

      return response.data.results.map((result) => ({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score,
        published_date: result.published_date,
      }));
    } catch (error: any) {
      console.error('❌ Tavily Search Error:', error.message);
      return [];
    }
  }

  /**
   * Extract full article content using Tavily's Extract endpoint
   * Satisfies Tavily sponsor challenge requirement: Extract endpoint
   */
  async extractArticle(url: string): Promise<NewsArticle | null> {
    try {
      const response = await axios.post<TavilyExtractResponse>(
        `${this.baseUrl}/extract`,
        {
          api_key: this.apiKey,
          urls: [url],
        }
      );

      if (response.data.results.length === 0) {
        return null;
      }

      const extracted = response.data.results[0];

      console.log(`📄 Tavily Extract: Retrieved full content from ${url}`);

      return {
        title: '', // Title needs to come from search
        url: extracted.url,
        content: extracted.raw_content,
      };
    } catch (error: any) {
      console.error('❌ Tavily Extract Error:', error.message);
      return null;
    }
  }

  /**
   * Monitor portfolio stocks for relevant news
   * Uses Search endpoint with targeted ticker queries
   */
  async monitorPortfolio(tickers: string[]): Promise<NewsArticle[]> {
    if (tickers.length === 0) {
      return [];
    }

    // Create a query that searches for any of the tickers
    const query = tickers.join(' OR ');

    console.log(`👀 Monitoring portfolio: ${tickers.join(', ')}`);

    return await this.searchFinancialNews(query, 10);
  }

  /**
   * Search for specific ticker news
   */
  async searchTickerNews(ticker: string): Promise<NewsArticle[]> {
    return await this.searchFinancialNews(ticker, 5);
  }

  /**
   * Search for broad market news
   */
  async searchMarketNews(): Promise<NewsArticle[]> {
    const queries = [
      'Federal Reserve interest rates',
      'Stock market today',
      'S&P 500 news',
    ];

    const results: NewsArticle[] = [];

    for (const query of queries) {
      const news = await this.searchFinancialNews(query, 3);
      results.push(...news);
    }

    return results;
  }

  /**
   * Enhanced article extraction - combines search and extract
   * First searches to get title, then extracts full content
   */
  async getFullArticle(url: string, searchQuery?: string): Promise<NewsArticle | null> {
    // Extract full content
    const extracted = await this.extractArticle(url);

    if (!extracted) {
      return null;
    }

    // If we have a search query, try to get the title from search results
    if (searchQuery) {
      const searchResults = await this.searchFinancialNews(searchQuery, 10);
      const matchingResult = searchResults.find((r) => r.url === url);

      if (matchingResult) {
        return {
          ...extracted,
          title: matchingResult.title,
          published_date: matchingResult.published_date,
          score: matchingResult.score,
        };
      }
    }

    return extracted;
  }

  /**
   * Filter news articles by relevance to specific tickers
   */
  filterRelevantNews(articles: NewsArticle[], tickers: string[]): NewsArticle[] {
    return articles.filter((article) => {
      const content = (article.title + ' ' + article.content).toLowerCase();
      return tickers.some((ticker) =>
        content.includes(ticker.toLowerCase())
      );
    });
  }

  /**
   * Find the most relevant article for a specific ticker
   */
  getMostRelevantArticle(
    articles: NewsArticle[],
    ticker: string
  ): NewsArticle | null {
    const tickerLower = ticker.toLowerCase();

    let bestArticle: NewsArticle | null = null;
    let maxMentions = 0;

    for (const article of articles) {
      const content = (article.title + ' ' + article.content).toLowerCase();
      const mentions = (
        content.match(new RegExp(tickerLower, 'g')) || []
      ).length;

      if (mentions > maxMentions) {
        maxMentions = mentions;
        bestArticle = article;
      }
    }

    return maxMentions > 0 ? bestArticle : null;
  }
}
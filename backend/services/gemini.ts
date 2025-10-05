import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiAnalysis, Holding, NewsArticle, TradingDecision } from '../utils/types';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  /**
   * Analyze news impact on a stock and recommend trading action
   * Uses Gemini's reasoning capabilities for the Gemini sponsor challenge
   */
  async analyzeNewsImpact(
    newsContent: string,
    ticker: string,
    portfolio: Holding[]
  ): Promise<GeminiAnalysis> {
    const prompt = `You are an expert financial analyst AI. Analyze this breaking news and its impact on a stock position.

CONTEXT:
Portfolio Holdings: ${JSON.stringify(portfolio, null, 2)}
Stock in Question: ${ticker}
Breaking News: "${newsContent}"

TASK:
Analyze this news and recommend a trading action.

OUTPUT FORMAT (JSON only, no other text):
{
  "impact_score": <number 1-10>,
  "sentiment": "bullish" | "bearish" | "neutral",
  "action": "buy" | "sell" | "hold",
  "confidence": <number 0-1>,
  "amount_usd": <recommended trade size in USD>,
  "reasoning": "<2-3 sentence explanation>"
}

EXAMPLES:
News: "Apple announces record iPhone sales beating all expectations by 20%"
Output: {"impact_score": 9, "sentiment": "bullish", "action": "buy", "confidence": 0.9, "amount_usd": 500, "reasoning": "Record sales indicate strong demand and will likely drive stock price up. High confidence buy signal with significant upside potential."}

News: "Tesla faces major recall affecting 500,000 vehicles due to battery issues"
Output: {"impact_score": 8, "sentiment": "bearish", "action": "sell", "confidence": 0.85, "amount_usd": 300, "reasoning": "Large-scale recall will hurt brand reputation and incur significant costs. Recommend reducing position before market fully prices in the negative impact."}

News: "NVIDIA announces partnership with Microsoft for AI chip development"
Output: {"impact_score": 8, "sentiment": "bullish", "action": "buy", "confidence": 0.88, "amount_usd": 450, "reasoning": "Strategic partnership with tech giant validates NVIDIA's AI leadership. Expected to boost revenue and market position significantly."}

IMPORTANT RULES:
- impact_score must be between 1-10
- confidence must be between 0-1
- amount_usd should be between 100-1000 based on impact and confidence
- Only recommend "buy" or "sell" if impact_score >= 7 and confidence >= 0.75
- Otherwise recommend "hold"
- Be realistic and conservative in analysis
- Consider market conditions and portfolio exposure

Now analyze the provided news:`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      console.log('🤖 Gemini Analysis Response:', response);

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);

        // Validate the response
        if (
          typeof analysis.impact_score === 'number' &&
          typeof analysis.confidence === 'number' &&
          ['buy', 'sell', 'hold'].includes(analysis.action) &&
          ['bullish', 'bearish', 'neutral'].includes(analysis.sentiment)
        ) {
          console.log(`✅ Gemini Analysis Complete: ${analysis.action.toUpperCase()} ${ticker}`);
          return analysis;
        }
      }

      throw new Error('Invalid response format from Gemini');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Gemini Analysis Error:', errorMessage);

      // Return safe default
      return {
        impact_score: 5,
        sentiment: 'neutral',
        action: 'hold',
        confidence: 0.5,
        amount_usd: 0,
        reasoning: 'Unable to analyze news due to API error. Holding position.',
      };
    }
  }

  /**
   * Generate a human-readable explanation of the trading decision
   * Uses Gemini for natural language generation
   */
  async explainDecision(
    news: NewsArticle,
    analysis: GeminiAnalysis & { ticker: string },
    decision: TradingDecision
  ): Promise<string> {
    const prompt = `You are explaining a trading decision to a user in simple, clear language.

NEWS: "${news.title}"
ANALYSIS: Impact ${analysis.impact_score}/10, Sentiment: ${analysis.sentiment}, Confidence: ${(analysis.confidence * 100).toFixed(0)}%
DECISION: ${decision.action.toUpperCase()} ${decision.shares} shares of ${decision.ticker} for $${decision.amount_usd}
TRANSACTION: ${decision.xrpl_tx ? `Executed on blockchain at ${decision.explorer_link}` : 'Transaction pending'}

Generate a 2-3 sentence explanation of why this decision was made, written in first person as the AI agent. Be confident and clear.

Example: "I detected breaking news about Apple's record sales within 30 seconds of publication. My analysis showed a 9/10 bullish impact with 90% confidence, so I immediately purchased $500 worth of AAPL shares. The transaction is now permanently recorded on the XRP Ledger for full transparency."

Now generate the explanation:`;

    try {
      const result = await this.model.generateContent(prompt);
      const explanation = result.response.text().trim();

      console.log('📝 Gemini Explanation Generated');

      return explanation;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Gemini Explanation Error:', errorMessage);

      // Return fallback explanation
      return `I analyzed news about ${decision.ticker} with an impact score of ${analysis.impact_score}/10. Based on ${analysis.sentiment} sentiment and ${(analysis.confidence * 100).toFixed(0)}% confidence, I decided to ${decision.action} ${decision.shares} shares for $${decision.amount_usd}. ${decision.xrpl_tx ? `Transaction hash: ${decision.xrpl_tx}` : ''}`;
    }
  }

  /**
   * Generate a market summary from multiple news articles
   */
  async summarizeMarketNews(articles: NewsArticle[]): Promise<string> {
    if (articles.length === 0) {
      return 'No significant market news at this time.';
    }

    const newsText = articles
      .slice(0, 5)
      .map((a, i) => `${i + 1}. ${a.title}: ${a.content.substring(0, 200)}...`)
      .join('\n');

    const prompt = `Summarize the current market sentiment based on these recent news articles:

${newsText}

Provide a 2-3 sentence summary of the overall market sentiment and key trends.`;

    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Gemini Summary Error:', errorMessage);
      return 'Unable to generate market summary at this time.';
    }
  }

  /**
   * Assess risk for a proposed trade
   */
  async assessTradeRisk(
    ticker: string,
    action: 'buy' | 'sell',
    amount: number,
    currentExposure: number,
    portfolioValue: number
  ): Promise<{ riskLevel: 'low' | 'medium' | 'high'; explanation: string }> {
    const exposurePercent = (amount / portfolioValue) * 100;

    const prompt = `Assess the risk of this proposed trade:

Ticker: ${ticker}
Action: ${action.toUpperCase()}
Amount: $${amount}
Current Exposure to ${ticker}: ${currentExposure.toFixed(2)}%
Trade Size as % of Portfolio: ${exposurePercent.toFixed(2)}%
Total Portfolio Value: $${portfolioValue}

Respond in JSON format:
{
  "riskLevel": "low" | "medium" | "high",
  "explanation": "<1-2 sentence risk assessment>"
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fallback risk assessment
      if (exposurePercent > 20) {
        return {
          riskLevel: 'high',
          explanation: 'Trade size exceeds 20% of portfolio value.',
        };
      } else if (exposurePercent > 10) {
        return {
          riskLevel: 'medium',
          explanation: 'Trade size is moderate relative to portfolio.',
        };
      }
    }

    return {
      riskLevel: 'low',
      explanation: 'Trade size is within acceptable risk parameters.',
    };
  }
}
'use client';

interface Holding {
  ticker: string;
  shares: number;
  avg_price: number;
}

interface Portfolio {
  holdings: Holding[];
  cash_balance: number;
  risk_tolerance: string;
}

interface PortfolioPanelProps {
  portfolio: Portfolio | null;
}

export function PortfolioPanel({ portfolio }: PortfolioPanelProps) {
  if (!portfolio) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-2xl font-bold mb-4">Portfolio</h2>
        <p className="text-gray-400">Loading portfolio...</p>
      </div>
    );
  }

  const totalValue = portfolio.holdings.reduce(
    (sum, h) => sum + h.shares * h.avg_price,
    0
  ) + portfolio.cash_balance;

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-2xl font-bold mb-4">Portfolio</h2>

      <div className="space-y-3">
        {portfolio.holdings.map((holding) => {
          const value = holding.shares * holding.avg_price;
          const percentage = ((value / totalValue) * 100).toFixed(1);

          return (
            <div key={holding.ticker} className="flex justify-between items-center p-3 bg-gray-900 rounded border border-gray-700">
              <div>
                <span className="font-bold text-lg text-blue-400">{holding.ticker}</span>
                <span className="text-gray-400 ml-2">{holding.shares} shares</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">${value.toFixed(2)}</div>
                <div className="text-sm text-gray-400">@${holding.avg_price} ({percentage}%)</div>
              </div>
            </div>
          );
        })}

        <div className="border-t border-gray-700 pt-3 mt-3">
          <div className="flex justify-between font-bold p-3 bg-gray-900 rounded border border-gray-700">
            <span className="text-green-400">Cash Balance</span>
            <span className="text-green-400">${portfolio.cash_balance.toFixed(2)}</span>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-3 mt-3">
          <div className="flex justify-between font-bold text-lg p-3 bg-gradient-to-r from-blue-900 to-purple-900 rounded border border-blue-700">
            <span>Total Value</span>
            <span>${totalValue.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

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
      <div className="bg-card rounded-lg p-6 border border-border">
        <h2 className="text-2xl font-bold mb-4">Portfolio</h2>
        <p className="text-muted-foreground">Loading portfolio...</p>
      </div>
    );
  }

  const totalValue = portfolio.holdings.reduce(
    (sum, h) => sum + h.shares * h.avg_price,
    0
  ) + portfolio.cash_balance;

  return (
    <div className="bg-card rounded-lg p-6 border border-border">
      <h2 className="text-2xl font-bold mb-4">Portfolio</h2>

      <div className="space-y-3">
        {portfolio.holdings.map((holding) => {
          const value = holding.shares * holding.avg_price;
          const percentage = ((value / totalValue) * 100).toFixed(1);

          return (
            <div key={holding.ticker} className="flex justify-between items-center p-3 bg-muted rounded border border-border">
              <div>
                <span className="font-bold text-lg text-accent">{holding.ticker}</span>
                <span className="text-muted-foreground ml-2">{holding.shares} shares</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">${value.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">@${holding.avg_price} ({percentage}%)</div>
              </div>
            </div>
          );
        })}

        <div className="border-t border-border pt-3 mt-3">
          <div className="flex justify-between font-bold p-3 bg-muted rounded border border-border">
            <span className="text-accent">Cash Balance</span>
            <span className="text-accent">${portfolio.cash_balance.toFixed(2)}</span>
          </div>
        </div>

        <div className="border-t border-border pt-3 mt-3">
          <div className="flex justify-between font-bold text-lg p-3 bg-accent/10 rounded border border-accent">
            <span>Total Value</span>
            <span>${totalValue.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

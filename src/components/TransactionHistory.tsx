'use client';

interface Trade {
  ticker: string;
  action: 'buy' | 'sell';
  shares: number;
  price: number;
  timestamp: number;
}

interface TransactionHistoryProps {
  trades: Trade[];
}

export function TransactionHistory({ trades }: TransactionHistoryProps) {
  if (!trades || trades.length === 0) {
    return (
      <div className="bg-card rounded-lg p-6 mt-6 border border-border">
        <h2 className="text-2xl font-bold mb-4">Transaction History</h2>
        <p className="text-muted-foreground">No transactions yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg p-6 mt-6 border border-border">
      <h2 className="text-2xl font-bold mb-4">Transaction History</h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-muted-foreground font-semibold">Time</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-semibold">Action</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-semibold">Ticker</th>
              <th className="text-right py-3 px-4 text-muted-foreground font-semibold">Shares</th>
              <th className="text-right py-3 px-4 text-muted-foreground font-semibold">Price</th>
              <th className="text-right py-3 px-4 text-muted-foreground font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade, i) => {
              const total = trade.shares * trade.price;
              const time = new Date(trade.timestamp).toLocaleString();

              return (
                <tr key={i} className="border-b border-border hover:bg-muted transition-colors">
                  <td className="py-3 px-4 text-muted-foreground text-sm">{time}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        trade.action === 'buy'
                          ? 'bg-accent/20 text-accent'
                          : 'bg-red-900 text-red-300'
                      }`}
                    >
                      {trade.action.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-accent">{trade.ticker}</td>
                  <td className="py-3 px-4 text-right">{trade.shares}</td>
                  <td className="py-3 px-4 text-right">${trade.price.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-semibold">
                    ${total.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

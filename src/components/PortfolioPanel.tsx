'use client';

import { useState } from 'react';
import { api, UserInfo } from '@/lib/api';

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
  user?: UserInfo;
}

interface TickerSearchResult {
  ticker: string;
  name: string;
  exchange: string;
  logo: string;
}

export function PortfolioPanel({ portfolio, user }: PortfolioPanelProps) {
  const [showAddTicker, setShowAddTicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TickerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingCash, setEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState('');

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const data = await api.searchTickers(query);
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Failed to search tickers:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddTicker = async (ticker: string) => {
    setIsAdding(true);
    try {
      await api.addTicker(ticker);
      setShowAddTicker(false);
      setSearchQuery('');
      setSearchResults([]);
      // Reload the page to refresh the portfolio
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to add ticker:', error);
      alert(error.message || 'Failed to add ticker. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateCashBalance = async () => {
    const newBalance = parseFloat(cashInput);
    if (isNaN(newBalance) || newBalance < 0) {
      alert('Please enter a valid positive number');
      return;
    }

    try {
      await api.updateCashBalance(newBalance);
      setEditingCash(false);
      setCashInput('');
      // Reload the page to refresh the portfolio
      window.location.reload();
    } catch (error) {
      console.error('Failed to update cash balance:', error);
      alert('Failed to update cash balance. Please try again.');
    }
  };

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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Portfolio</h2>
        <button
          onClick={() => setShowAddTicker(!showAddTicker)}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-semibold transition-colors text-sm"
        >
          {showAddTicker ? 'Cancel' : '+ Add Ticker'}
        </button>
      </div>

      {showAddTicker && (
        <div className="mb-4 p-4 bg-muted rounded-lg border border-border">
          <input
            type="text"
            placeholder="Search for a ticker (e.g., AAPL, TSLA)"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg mb-2"
          />

          {isSearching && (
            <p className="text-muted-foreground text-sm">Searching...</p>
          )}

          {searchResults.length > 0 && (
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((result) => (
                <div
                  key={result.ticker}
                  className="flex justify-between items-center p-3 bg-background rounded border border-border hover:border-accent cursor-pointer transition-colors"
                  onClick={() => handleAddTicker(result.ticker)}
                >
                  <div className="flex items-center gap-3">
                    <img src={result.logo} alt={result.ticker} className="w-8 h-8 rounded" />
                    <div>
                      <div className="font-bold text-accent">{result.ticker}</div>
                      <div className="text-sm text-muted-foreground">{result.name}</div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">{result.exchange}</div>
                </div>
              ))}
            </div>
          )}

          {!isSearching && searchQuery.length > 0 && searchResults.length === 0 && (
            <p className="text-muted-foreground text-sm">No results found</p>
          )}
        </div>
      )}

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
          <div className="flex justify-between items-center font-bold p-3 bg-muted rounded border border-border">
            <span className="text-accent">Cash Balance</span>
            {editingCash ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  placeholder={portfolio.cash_balance.toFixed(2)}
                  className="w-32 px-2 py-1 bg-background text-foreground border border-border rounded text-sm"
                  autoFocus
                />
                <button
                  onClick={handleUpdateCashBalance}
                  className="px-3 py-1 bg-accent hover:bg-accent-hover text-white rounded text-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingCash(false);
                    setCashInput('');
                  }}
                  className="px-3 py-1 bg-muted hover:bg-border text-foreground rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-accent">${portfolio.cash_balance.toFixed(2)}</span>
                <button
                  onClick={() => {
                    setEditingCash(true);
                    setCashInput(portfolio.cash_balance.toString());
                  }}
                  className="px-2 py-1 bg-accent/20 hover:bg-accent/30 text-accent rounded text-xs"
                >
                  Edit
                </button>
              </div>
            )}
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

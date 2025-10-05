'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { api, TickerSearchResult } from '@/lib/api';

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
  userEmail?: string;
  onUpdate?: () => void;
}

export function PortfolioPanel({ portfolio, userEmail, onUpdate }: PortfolioPanelProps) {
  const [showAddTicker, setShowAddTicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TickerSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingCash, setEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState('');

  // Selected ticker for adding
  const [selectedTicker, setSelectedTicker] = useState('');
  const [shares, setShares] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [error, setError] = useState('');

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-search as user types
  useEffect(() => {
    if (searchQuery.length >= 1) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const results = await api.searchTickers(searchQuery, 10, 'stock');
          setSearchResults(results);
          setShowDropdown(results.length > 0);
        } catch (error) {
          console.error('Failed to search tickers:', error);
          setSearchResults([]);
          setShowDropdown(false);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectTicker = (result: TickerSearchResult) => {
    setSelectedTicker(result.symbol);
    setSearchQuery('');
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleAddTicker = async () => {
    if (!userEmail || !portfolio) {
      setError('User email or portfolio not available');
      return;
    }

    if (!selectedTicker || !shares || !avgPrice) {
      setError('Please fill in all fields');
      return;
    }

    const sharesNum = parseFloat(shares);
    const priceNum = parseFloat(avgPrice);

    if (sharesNum <= 0 || priceNum <= 0) {
      setError('Shares and price must be positive numbers');
      return;
    }

    if (portfolio.holdings.some(h => h.ticker === selectedTicker)) {
      setError('Ticker already exists in portfolio');
      return;
    }

    setIsAdding(true);
    setError('');

    try {
      const updatedHoldings = [
        ...portfolio.holdings,
        { ticker: selectedTicker, shares: sharesNum, avg_price: priceNum }
      ];

      await api.updateUserConfig(userEmail, { holdings: updatedHoldings });

      // Reset form
      setShowAddTicker(false);
      setSelectedTicker('');
      setShares('');
      setAvgPrice('');
      setSearchQuery('');
      setSearchResults([]);

      // Trigger parent refresh
      if (onUpdate) onUpdate();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add ticker. Please try again.';
      console.error('Failed to add ticker:', error);
      setError(errorMessage);
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateCashBalance = async () => {
    if (!userEmail) {
      alert('User email not available');
      return;
    }

    const newBalance = parseFloat(cashInput);
    if (isNaN(newBalance) || newBalance < 0) {
      alert('Please enter a valid positive number');
      return;
    }

    try {
      await api.updateUserConfig(userEmail, { cash_balance: newBalance });
      setEditingCash(false);
      setCashInput('');

      // Trigger parent refresh
      if (onUpdate) onUpdate();
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
        <div className="mb-4 p-4 bg-muted rounded-lg border border-border space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground">Add New Holding</h3>

          {/* Ticker Search */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              Search Ticker
            </label>
            <input
              type="text"
              placeholder="Type to search (e.g., AAPL, TSLA)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              onFocus={() => searchQuery.length >= 1 && searchResults.length > 0 && setShowDropdown(true)}
            />
            {isSearching && (
              <div className="absolute right-3 top-8">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}

            {/* Autocomplete Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={`${result.symbol}-${result.exchange}`}
                    onClick={() => selectTicker(result)}
                    className="w-full px-4 py-2 text-left hover:bg-muted transition-colors border-b border-border last:border-b-0 flex items-center gap-3"
                  >
                    {result.logo && (
                      <Image
                        src={result.logo}
                        alt={result.symbol}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded object-contain bg-white flex-shrink-0"
                        unoptimized
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold font-mono text-sm">{result.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate">{result.name}</div>
                    </div>
                    <div className="text-xs text-muted-foreground flex-shrink-0">{result.exchange}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Ticker + Details */}
          {selectedTicker && (
            <div className="p-3 bg-accent/10 border border-accent rounded-lg">
              <div className="font-mono font-bold text-accent">{selectedTicker}</div>
            </div>
          )}

          {/* Shares and Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">
                Shares
              </label>
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="10"
                min="0"
                step="0.01"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">
                Avg Price ($)
              </label>
              <input
                type="number"
                value={avgPrice}
                onChange={(e) => setAvgPrice(e.target.value)}
                placeholder="150.50"
                min="0"
                step="0.01"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/50 rounded text-red-500 text-xs">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleAddTicker}
              disabled={isAdding || !selectedTicker}
              className="flex-1 px-4 py-2 bg-accent hover:bg-accent-hover disabled:bg-muted disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors text-sm"
            >
              {isAdding ? 'Adding...' : 'Add Holding'}
            </button>
            <button
              onClick={() => {
                setShowAddTicker(false);
                setSelectedTicker('');
                setShares('');
                setAvgPrice('');
                setSearchQuery('');
                setError('');
              }}
              className="px-4 py-2 bg-background hover:bg-muted border border-border rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {portfolio.holdings.map((holding) => {
          const value = holding.shares * holding.avg_price;
          const percentage = ((value / totalValue) * 100).toFixed(1);

          return (
            <div key={holding.ticker} className="flex justify-between items-center p-3 bg-muted rounded border border-border group hover:border-accent transition-colors">
              <div>
                <span className="font-bold text-lg text-accent">{holding.ticker}</span>
                <span className="text-muted-foreground ml-2">{holding.shares} shares</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-semibold">${value.toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground">@${holding.avg_price} ({percentage}%)</div>
                </div>
                <button
                  onClick={async () => {
                    if (!userEmail) return;
                    if (confirm(`Remove ${holding.ticker} from portfolio?`)) {
                      try {
                        await api.removeHolding(userEmail, holding.ticker);
                        if (onUpdate) onUpdate();
                      } catch (error) {
                        console.error('Failed to remove holding:', error);
                        alert('Failed to remove holding. Please try again.');
                      }
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-500 rounded text-xs transition-all"
                  title="Remove holding"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
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

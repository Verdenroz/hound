'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Trash2, Plus, X, Check, Pencil } from 'lucide-react';
import { api, TickerSearchResult } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

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
  const [editingRisk, setEditingRisk] = useState(false);
  const [riskInput, setRiskInput] = useState('');

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

  const handleUpdateRiskTolerance = async () => {
    if (!userEmail) {
      alert('User email not available');
      return;
    }

    if (!['conservative', 'moderate', 'aggressive'].includes(riskInput)) {
      alert('Please select a valid risk tolerance');
      return;
    }

    try {
      await api.updateUserConfig(userEmail, { risk_tolerance: riskInput });
      setEditingRisk(false);
      setRiskInput('');

      // Trigger parent refresh
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to update risk tolerance:', error);
      alert('Failed to update risk tolerance. Please try again.');
    }
  };

  if (!portfolio) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio</CardTitle>
          <CardDescription>Loading portfolio...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalValue = portfolio.holdings.reduce(
    (sum, h) => sum + h.shares * h.avg_price,
    0
  ) + portfolio.cash_balance;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Portfolio</CardTitle>
            <CardDescription>Manage your holdings and settings</CardDescription>
          </div>
          <Button
            onClick={() => setShowAddTicker(!showAddTicker)}
            variant={showAddTicker ? "outline" : "default"}
            size="sm"
          >
            {showAddTicker ? (
              <>
                <X className="h-4 w-4" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Add Ticker
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showAddTicker && (
          <Card className="bg-muted/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Add New Holding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Ticker Search */}
              <div className="relative" ref={dropdownRef}>
                <label className="block text-xs font-medium mb-1.5 text-muted-foreground">
                  Search Ticker
                </label>
                <Input
                  type="text"
                  placeholder="Type to search (e.g., AAPL, TSLA)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery.length >= 1 && searchResults.length > 0 && setShowDropdown(true)}
                />
                {isSearching && (
                  <div className="absolute right-3 top-8">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}

                {/* Autocomplete Dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-card border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={`${result.symbol}-${result.exchange}`}
                        onClick={() => selectTicker(result)}
                        className="w-full px-4 py-2 text-left hover:bg-muted transition-colors border-b last:border-b-0 flex items-center gap-3"
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

              {/* Selected Ticker */}
              {selectedTicker && (
                <div className="p-3 bg-primary/10 border border-primary rounded-lg">
                  <Badge variant="outline" className="font-mono font-bold">{selectedTicker}</Badge>
                </div>
              )}

              {/* Shares and Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-muted-foreground">
                    Shares
                  </label>
                  <Input
                    type="number"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    placeholder="10"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-muted-foreground">
                    Avg Price ($)
                  </label>
                  <Input
                    type="number"
                    value={avgPrice}
                    onChange={(e) => setAvgPrice(e.target.value)}
                    placeholder="150.50"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {error && (
                <div className="p-2 bg-destructive/10 border border-destructive/50 rounded text-destructive text-xs">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleAddTicker}
                  disabled={isAdding || !selectedTicker}
                  className="flex-1"
                  size="sm"
                >
                  <Check className="h-4 w-4" />
                  {isAdding ? 'Adding...' : 'Add Holding'}
                </Button>
                <Button
                  onClick={() => {
                    setShowAddTicker(false);
                    setSelectedTicker('');
                    setShares('');
                    setAvgPrice('');
                    setSearchQuery('');
                    setError('');
                  }}
                  variant="outline"
                  size="sm"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Holdings List */}
        <div className="space-y-2">
          {portfolio.holdings.map((holding) => {
            const value = holding.shares * holding.avg_price;
            const percentage = ((value / totalValue) * 100).toFixed(1);

            return (
              <div key={holding.ticker} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border group hover:border-primary/50 transition-all">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="font-mono font-bold text-base px-3">
                    {holding.ticker}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{holding.shares} shares</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-semibold">${value.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">@${holding.avg_price} • {percentage}%</div>
                  </div>
                  <Button
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
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Cash Balance */}
        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border">
          <span className="font-semibold">Cash Balance</span>
          {editingCash ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value)}
                placeholder={portfolio.cash_balance.toFixed(2)}
                className="w-32 h-8"
                autoFocus
              />
              <Button onClick={handleUpdateCashBalance} size="icon-sm" variant="default">
                <Check className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => {
                  setEditingCash(false);
                  setCashInput('');
                }}
                size="icon-sm"
                variant="outline"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg">${portfolio.cash_balance.toFixed(2)}</span>
              <Button
                onClick={() => {
                  setEditingCash(true);
                  setCashInput(portfolio.cash_balance.toString());
                }}
                size="icon-sm"
                variant="ghost"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Risk Tolerance */}
        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border">
          <span className="font-semibold">Risk Tolerance</span>
          {editingRisk ? (
            <div className="flex items-center gap-2">
              <Select value={riskInput} onValueChange={setRiskInput}>
                <SelectTrigger className="w-40 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">Conservative</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="aggressive">Aggressive</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleUpdateRiskTolerance} size="icon-sm" variant="default">
                <Check className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => {
                  setEditingRisk(false);
                  setRiskInput('');
                }}
                size="icon-sm"
                variant="outline"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">{portfolio.risk_tolerance}</Badge>
              <Button
                onClick={() => {
                  setEditingRisk(true);
                  setRiskInput(portfolio.risk_tolerance);
                }}
                size="icon-sm"
                variant="ghost"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Total Value */}
        <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg border border-primary">
          <span className="text-lg font-bold">Total Value</span>
          <span className="text-xl font-bold font-mono">${totalValue.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

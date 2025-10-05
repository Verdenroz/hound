'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ArrowRight, ArrowLeft, Check, Search, X } from 'lucide-react';
import { api, TickerSearchResult } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface OnboardingModalProps {
  email: string;
  onComplete: () => void;
}

interface Holding {
  ticker: string;
  shares: number;
  avg_price: number;
}

export function OnboardingModal({ email, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [cashBalance, setCashBalance] = useState('10000');
  const [riskTolerance, setRiskTolerance] = useState('moderate');
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [newTicker, setNewTicker] = useState('');
  const [newShares, setNewShares] = useState('');
  const [newAvgPrice, setNewAvgPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Ticker search autocomplete
  const [searchResults, setSearchResults] = useState<TickerSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search for tickers as user types
  useEffect(() => {
    if (newTicker.length >= 1) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const results = await api.searchTickers(newTicker, 10, 'stock');
          setSearchResults(results);
          setShowDropdown(results.length > 0);
        } catch (error) {
          console.error('Failed to search tickers:', error);
          setSearchResults([]);
          setShowDropdown(false);
        } finally {
          setIsSearching(false);
        }
      }, 300); // Debounce 300ms
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [newTicker]);

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
    setNewTicker(result.symbol);
    setShowDropdown(false);
  };

  const addHolding = () => {
    if (!newTicker || !newShares || !newAvgPrice) {
      setError('Please fill in all holding fields');
      return;
    }

    const ticker = newTicker.toUpperCase();
    const shares = parseFloat(newShares);
    const avgPrice = parseFloat(newAvgPrice);

    if (shares <= 0 || avgPrice <= 0) {
      setError('Shares and price must be positive numbers');
      return;
    }

    if (holdings.some(h => h.ticker === ticker)) {
      setError('Ticker already added');
      return;
    }

    setHoldings([...holdings, { ticker, shares, avg_price: avgPrice }]);
    setNewTicker('');
    setNewShares('');
    setNewAvgPrice('');
    setError('');
  };

  const removeHolding = (ticker: string) => {
    setHoldings(holdings.filter(h => h.ticker !== ticker));
  };

  const handleSubmit = async () => {
    const balance = parseFloat(cashBalance);

    if (balance <= 0) {
      setError('Cash balance must be a positive number');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await api.createUserConfig(email, balance, riskTolerance, holdings);
      onComplete();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save configuration';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} modal>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-3xl flex items-center gap-2">
            🐕 Welcome to Hound AI!
          </DialogTitle>
          <DialogDescription className="text-base">
            Let&apos;s set up your autonomous trading portfolio
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Cash Balance & Risk */}
        {step === 1 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Initial Configuration</CardTitle>
                <CardDescription>Set your starting capital and risk preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cash-balance">Initial Cash Balance (USD)</Label>
                  <Input
                    id="cash-balance"
                    type="number"
                    value={cashBalance}
                    onChange={(e) => setCashBalance(e.target.value)}
                    placeholder="10000"
                    min="0"
                    step="100"
                  />
                  <p className="text-xs text-muted-foreground">
                    This is your starting capital for trading
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="risk-tolerance">Risk Tolerance</Label>
                  <Select value={riskTolerance} onValueChange={setRiskTolerance}>
                    <SelectTrigger id="risk-tolerance">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Conservative</span>
                          <span className="text-xs text-muted-foreground">Low risk, steady returns</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="moderate">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Moderate</span>
                          <span className="text-xs text-muted-foreground">Balanced approach</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="aggressive">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Aggressive</span>
                          <span className="text-xs text-muted-foreground">High risk, high reward</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This affects the agent&apos;s trading decisions
                  </p>
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/50 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => setStep(2)} size="lg">
                Next: Portfolio Holdings
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Portfolio Holdings */}
        {step === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Portfolio Holdings (Optional)</CardTitle>
                <CardDescription>
                  Add stocks you want the AI agent to monitor and trade. You can skip this and let the agent build your portfolio.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Existing Holdings */}
                {holdings.length > 0 && (
                  <div className="space-y-2">
                    {holdings.map((holding) => (
                      <div
                        key={holding.ticker}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                      >
                        <div className="flex items-center gap-4">
                          <Badge variant="secondary" className="font-mono font-bold">
                            {holding.ticker}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {holding.shares} shares @ ${holding.avg_price.toFixed(2)}
                          </span>
                        </div>
                        <Button
                          onClick={() => removeHolding(holding.ticker)}
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Separator />
                  </div>
                )}

                {/* Add New Holding */}
                <div className="space-y-3">
                  <Label>Add New Holding</Label>
                  <div className="relative" ref={dropdownRef}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        value={newTicker}
                        onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                        placeholder="Search ticker (e.g., AAPL)"
                        className="pl-9"
                        onFocus={() => newTicker.length >= 1 && searchResults.length > 0 && setShowDropdown(true)}
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>

                    {/* Autocomplete Dropdown */}
                    {showDropdown && searchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-card border rounded-lg shadow-xl max-h-64 overflow-y-auto">
                        {searchResults.map((result) => (
                          <button
                            key={`${result.symbol}-${result.exchange}`}
                            onClick={() => selectTicker(result)}
                            className="w-full px-4 py-3 text-left hover:bg-muted transition-colors border-b last:border-b-0 flex items-center gap-3"
                          >
                            {result.logo && (
                              <Image
                                src={result.logo}
                                alt={result.symbol}
                                width={32}
                                height={32}
                                className="w-8 h-8 rounded object-contain bg-white"
                                unoptimized
                              />
                            )}
                            <div className="flex-1">
                              <div className="font-semibold font-mono">{result.symbol}</div>
                              <div className="text-sm text-muted-foreground">{result.name}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {result.exchange}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="shares">Shares</Label>
                      <Input
                        id="shares"
                        type="number"
                        value={newShares}
                        onChange={(e) => setNewShares(e.target.value)}
                        placeholder="10"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="avg-price">Avg Price ($)</Label>
                      <Input
                        id="avg-price"
                        type="number"
                        value={newAvgPrice}
                        onChange={(e) => setNewAvgPrice(e.target.value)}
                        placeholder="150.50"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <Button onClick={addHolding} variant="outline" className="w-full">
                    <Check className="h-4 w-4" />
                    Add Holding
                  </Button>
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/50 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            <DialogFooter className="flex flex-row gap-2 justify-between">
              <Button onClick={() => setStep(1)} variant="outline" size="lg">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Complete Setup
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

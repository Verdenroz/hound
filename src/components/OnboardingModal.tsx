'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

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
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            🐕 Welcome to Hound AI!
          </h2>
          <p className="text-muted-foreground">
            Let's set up your autonomous trading portfolio
          </p>
        </div>

        {/* Step 1: Cash Balance & Risk */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Initial Cash Balance (USD)
              </label>
              <input
                type="number"
                value={cashBalance}
                onChange={(e) => setCashBalance(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="10000"
                min="0"
                step="100"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This is your starting capital for trading
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Risk Tolerance
              </label>
              <select
                value={riskTolerance}
                onChange={(e) => setRiskTolerance(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="conservative">Conservative - Low risk, steady returns</option>
                <option value="moderate">Moderate - Balanced approach</option>
                <option value="aggressive">Aggressive - High risk, high reward</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                This affects the agent's trading decisions
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-semibold transition-colors"
              >
                Next: Portfolio Holdings →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Portfolio Holdings */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">
                Portfolio Holdings (Optional)
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add stocks you want the AI agent to monitor and trade. You can skip this and let the agent build your portfolio.
              </p>

              {/* Existing Holdings */}
              {holdings.length > 0 && (
                <div className="mb-4 space-y-2">
                  {holdings.map((holding) => (
                    <div
                      key={holding.ticker}
                      className="flex items-center justify-between p-3 bg-background border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold">{holding.ticker}</span>
                        <span className="text-sm text-muted-foreground">
                          {holding.shares} shares @ ${holding.avg_price.toFixed(2)}
                        </span>
                      </div>
                      <button
                        onClick={() => removeHolding(holding.ticker)}
                        className="text-red-500 hover:text-red-400 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Holding */}
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                  placeholder="Ticker (e.g., AAPL)"
                  className="px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <input
                  type="number"
                  value={newShares}
                  onChange={(e) => setNewShares(e.target.value)}
                  placeholder="Shares"
                  min="0"
                  step="0.01"
                  className="px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <input
                  type="number"
                  value={newAvgPrice}
                  onChange={(e) => setNewAvgPrice(e.target.value)}
                  placeholder="Avg Price"
                  min="0"
                  step="0.01"
                  className="px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <button
                onClick={addHolding}
                className="mt-2 w-full px-4 py-2 bg-background hover:bg-muted border border-border rounded-lg transition-colors text-sm"
              >
                + Add Holding
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-between gap-3 pt-4 border-t border-border">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 bg-background hover:bg-muted border border-border rounded-lg font-semibold transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-3 bg-accent hover:bg-accent-hover disabled:bg-muted disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Complete Setup ✓'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

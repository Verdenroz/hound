'use client';

import { TrendingUp, TrendingDown, History } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <CardDescription>Track all trading activity</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No transactions yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Transaction History
        </CardTitle>
        <CardDescription>Track all trading activity</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade, i) => {
                const total = trade.shares * trade.price;
                const time = new Date(trade.timestamp).toLocaleString();
                const isBuy = trade.action === 'buy';

                return (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground text-sm font-mono">
                      {time}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={isBuy ? "default" : "destructive"}
                        className="font-semibold"
                      >
                        {isBuy ? (
                          <>
                            <TrendingUp className="h-3 w-3" />
                            BUY
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-3 w-3" />
                            SELL
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono font-bold">
                        {trade.ticker}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {trade.shares}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${trade.price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-semibold font-mono">
                      ${total.toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

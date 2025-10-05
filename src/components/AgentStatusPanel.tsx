'use client';

import { Activity, Brain, TrendingUp, Shield, Zap, MessageSquare, Circle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface AgentStatusPanelProps {
  state: string;
  isRunning: boolean;
  wallet: string | null;
}

const STATE_CONFIGS = {
  idle: {
    color: 'bg-muted text-muted-foreground',
    label: 'Idle',
    icon: Circle,
  },
  monitoring: {
    color: 'bg-blue-500 text-white',
    label: 'Monitoring',
    icon: Activity,
  },
  analyzing: {
    color: 'bg-yellow-500 text-white',
    label: 'Analyzing',
    icon: Brain,
  },
  deciding: {
    color: 'bg-orange-500 text-white',
    label: 'Deciding',
    icon: TrendingUp,
  },
  risk_check: {
    color: 'bg-purple-500 text-white',
    label: 'Risk Check',
    icon: Shield,
  },
  executing: {
    color: 'bg-red-500 text-white',
    label: 'Executing',
    icon: Zap,
  },
  explaining: {
    color: 'bg-green-500 text-white',
    label: 'Explaining',
    icon: MessageSquare,
  },
};

export function AgentStatusPanel({ state, isRunning, wallet }: AgentStatusPanelProps) {
  const stateConfig = STATE_CONFIGS[state as keyof typeof STATE_CONFIGS] || STATE_CONFIGS.idle;
  const StateIcon = stateConfig.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Status</CardTitle>
        <CardDescription>Current state and configuration</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current State */}
        <div className="flex items-center gap-4">
          <div className={`flex items-center justify-center w-12 h-12 rounded-full ${stateConfig.color} ${isRunning ? 'animate-pulse' : ''}`}>
            <StateIcon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">Current State</div>
            <div className="text-2xl font-semibold">{stateConfig.label}</div>
          </div>
          {isRunning && (
            <Badge variant="default" className="bg-green-500 hover:bg-green-600">
              <Circle className="h-2 w-2 mr-1.5 fill-current animate-pulse" />
              Active
            </Badge>
          )}
        </div>

        {/* XRPL Wallet */}
        {wallet && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-sm font-medium">XRPL Wallet Address</div>
              <div className="p-3 bg-muted/50 rounded-lg border">
                <code className="text-xs font-mono break-all">{wallet}</code>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

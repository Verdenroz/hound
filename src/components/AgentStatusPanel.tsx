'use client';

interface AgentStatusPanelProps {
  state: string;
  isRunning: boolean;
  wallet: string | null;
}

const STATE_COLORS: Record<string, string> = {
  idle: 'bg-gray-600',
  monitoring: 'bg-blue-500',
  analyzing: 'bg-yellow-500',
  deciding: 'bg-orange-500',
  risk_check: 'bg-purple-500',
  executing: 'bg-red-500',
  explaining: 'bg-green-500',
};

const STATE_LABELS: Record<string, string> = {
  idle: 'Idle',
  monitoring: 'Monitoring',
  analyzing: 'Analyzing',
  deciding: 'Deciding',
  risk_check: 'Risk Check',
  executing: 'Executing',
  explaining: 'Explaining',
};

export function AgentStatusPanel({ state, isRunning, wallet }: AgentStatusPanelProps) {
  const stateColor = STATE_COLORS[state] || 'bg-gray-600';
  const stateLabel = STATE_LABELS[state] || state;

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-2xl font-bold mb-4">Agent Status</h2>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className={`w-4 h-4 rounded-full ${stateColor} ${isRunning ? 'animate-pulse' : ''}`}></div>
          <span className="text-xl capitalize">{stateLabel}</span>
        </div>

        {wallet && (
          <div className="mt-4 p-3 bg-gray-900 rounded border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">XRPL Wallet</div>
            <div className="font-mono text-xs break-all">{wallet}</div>
          </div>
        )}

        <div className="mt-4 flex gap-2 text-xs">
          {Object.keys(STATE_COLORS).map((s) => (
            <div
              key={s}
              className={`px-2 py-1 rounded transition-colors ${
                state === s ? STATE_COLORS[s] + ' text-white' : 'bg-gray-700 text-gray-400'
              }`}
            >
              {STATE_LABELS[s]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

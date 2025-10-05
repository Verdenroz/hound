'use client';

import { useEffect, useRef } from 'react';

interface AgentLog {
  timestamp: string;
  state: string;
  message: string;
  data?: unknown;
}

interface LogsPanelProps {
  logs: AgentLog[];
}

export function LogsPanel({ logs }: LogsPanelProps) {
  const logsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom of the logs container only
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-card rounded-lg p-6 col-span-2 border border-border">
      <h2 className="text-2xl font-bold mb-4">Agent Reasoning Log</h2>

      <div
        ref={logsContainerRef}
        className="bg-muted rounded border border-border p-4 max-h-96 overflow-y-auto font-mono text-sm"
      >
        {logs.length === 0 ? (
          <div className="text-muted-foreground">No logs yet. Start the agent to see activity.</div>
        ) : (
          <div className="space-y-2">
            {logs.map((log, i) => {
              const time = new Date(log.timestamp).toLocaleTimeString();

              return (
                <div key={i} className="border-l-2 border-accent pl-3 py-1">
                  <div className="flex gap-2 items-start">
                    <span className="text-muted-foreground text-xs whitespace-nowrap">{time}</span>
                    <span className="text-muted-foreground text-xs px-1.5 py-0.5 bg-card rounded uppercase">
                      {log.state}
                    </span>
                    <span className="flex-1">{log.message}</span>
                  </div>

                  {log.data && typeof log.data === 'object' && Object.keys(log.data).length > 0 ? (
                    <div className="text-muted-foreground ml-4 mt-1 text-xs">
                      <pre className="whitespace-pre-wrap break-words">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

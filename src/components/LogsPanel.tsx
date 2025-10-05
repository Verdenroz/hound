'use client';

import { useEffect, useRef } from 'react';
import { Terminal, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          Agent Reasoning Log
        </CardTitle>
        <CardDescription>Real-time agent activity and decision-making process</CardDescription>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-96 w-full rounded-lg border bg-muted/30 p-4" ref={logsContainerRef}>
          {logs.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Terminal className="h-4 w-4" />
              <span className="text-sm">No logs yet. Start the agent to see activity.</span>
            </div>
          ) : (
            <div className="space-y-3 font-mono text-sm">
              {logs.map((log, i) => {
                const time = new Date(log.timestamp).toLocaleTimeString();

                return (
                  <div key={i} className="border-l-2 border-primary pl-3 py-1.5 hover:bg-muted/50 transition-colors rounded-r">
                    <div className="flex gap-2 items-start flex-wrap">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs whitespace-nowrap">{time}</span>
                      </div>
                      <Badge variant="outline" className="text-xs font-mono uppercase">
                        {log.state}
                      </Badge>
                      <span className="flex-1 text-foreground min-w-0 break-words">{log.message}</span>
                    </div>

                    {log.data && typeof log.data === 'object' && Object.keys(log.data).length > 0 ? (
                      <div className="mt-2 ml-4 p-2 bg-card rounded border text-xs">
                        <pre className="whitespace-pre-wrap break-words text-muted-foreground">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Newspaper, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface NewsArticle {
  title: string;
  url: string;
  content: string;
  ticker?: string;
  score?: number;
  timestamp?: number;
}

interface NewsPanelProps {
  userEmail?: string;
}

export function NewsPanel({ userEmail }: NewsPanelProps) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [selectedNews, setSelectedNews] = useState<NewsArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userEmail) {
      setIsLoading(false);
      return;
    }

    const fetchNews = async () => {
      try {
        const response = await api.getNews(userEmail, 10) as { news: NewsArticle[] };
        setNews(response.news || []);
      } catch (error) {
        console.error('Failed to fetch news:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNews();

    // Refresh news every 10 seconds
    const interval = setInterval(fetchNews, 10000);
    return () => clearInterval(interval);
  }, [userEmail]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            News Feed
          </CardTitle>
          <CardDescription>Real-time market news and analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading news...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            News Feed
          </CardTitle>
          <CardDescription>Real-time market news and analysis</CardDescription>
        </CardHeader>

        <CardContent>
          {news.length === 0 ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Monitoring for relevant news...</span>
            </div>
          ) : (
            <ScrollArea className="h-[32rem]">
              <div className="space-y-3 pr-4">
                {news.map((article, index) => (
                  <div
                    key={`${article.url}-${index}`}
                    onClick={() => setSelectedNews(article)}
                    className="p-3 bg-muted/50 rounded-lg border hover:border-primary/50 cursor-pointer transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-sm line-clamp-2 flex-1 group-hover:text-primary transition-colors">
                        {article.title}
                      </h3>
                      {article.ticker && (
                        <Badge variant="secondary" className="font-mono flex-shrink-0">
                          {article.ticker}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {article.content?.substring(0, 150)}...
                    </p>

                    {article.score !== undefined && (
                      <div className="flex items-center gap-2">
                        <Progress value={article.score * 100} className="flex-1 h-1.5" />
                        <span className="text-xs text-muted-foreground font-medium min-w-[3rem] text-right">
                          {Math.round(article.score * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* News Detail Dialog */}
      <Dialog open={!!selectedNews} onOpenChange={(open) => !open && setSelectedNews(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start gap-3 mb-2">
              {selectedNews?.ticker && (
                <Badge variant="default" className="font-mono">
                  {selectedNews.ticker}
                </Badge>
              )}
              {selectedNews?.score !== undefined && (
                <Badge variant="outline">
                  {Math.round(selectedNews.score * 100)}% Relevance
                </Badge>
              )}
            </div>
            <DialogTitle className="text-xl">{selectedNews?.title}</DialogTitle>
            {selectedNews?.score !== undefined && (
              <div className="pt-2">
                <Progress value={selectedNews.score * 100} className="h-2" />
              </div>
            )}
          </DialogHeader>

          <div className="space-y-4">
            <DialogDescription className="text-base leading-relaxed whitespace-pre-wrap">
              {selectedNews?.content}
            </DialogDescription>

            {selectedNews?.url && (
              <Button asChild className="w-full sm:w-auto">
                <a
                  href={selectedNews.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Read full article
                </a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

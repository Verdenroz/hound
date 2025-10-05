'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

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
        const response = await api.getNews(userEmail, 10);
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
      <div className="bg-card rounded-lg p-6 border border-border">
        <h2 className="text-2xl font-bold mb-4">News Feed</h2>
        <div className="flex items-center gap-3">
          <div className="animate-pulse flex gap-2">
            <div className="w-2 h-2 bg-accent rounded-full"></div>
            <div className="w-2 h-2 bg-accent rounded-full"></div>
            <div className="w-2 h-2 bg-accent rounded-full"></div>
          </div>
          <p className="text-muted-foreground">Loading news...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-lg p-6 border border-border">
        <h2 className="text-2xl font-bold mb-4">News Feed</h2>

        {news.length === 0 ? (
          <div className="flex items-center gap-3">
            <div className="animate-pulse flex gap-2">
              <div className="w-2 h-2 bg-accent rounded-full"></div>
              <div className="w-2 h-2 bg-accent rounded-full"></div>
              <div className="w-2 h-2 bg-accent rounded-full"></div>
            </div>
            <p className="text-muted-foreground">Monitoring for relevant news...</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {news.map((article, index) => (
              <div
                key={`${article.url}-${index}`}
                onClick={() => setSelectedNews(article)}
                className="p-3 bg-muted rounded border border-border hover:border-accent cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-sm line-clamp-2 flex-1">
                    {article.title}
                  </h3>
                  {article.ticker && (
                    <span className="px-2 py-1 bg-accent/20 text-accent rounded text-xs font-mono flex-shrink-0">
                      {article.ticker}
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {article.content?.substring(0, 150)}...
                </p>

                {article.score !== undefined && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-background rounded-full h-1.5">
                      <div
                        className="bg-accent h-1.5 rounded-full transition-all"
                        style={{ width: `${article.score * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(article.score * 100)}%
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* News Detail Dialog */}
      {selectedNews && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedNews(null)}
        >
          <div
            className="bg-card border border-border rounded-lg max-w-2xl w-full p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                {selectedNews.ticker && (
                  <div className="inline-block px-3 py-1 bg-accent/20 text-accent rounded-full text-sm font-mono font-semibold mb-3">
                    {selectedNews.ticker}
                  </div>
                )}
                <h2 className="text-2xl font-bold mb-2">{selectedNews.title}</h2>
              </div>
              <button
                onClick={() => setSelectedNews(null)}
                className="ml-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {selectedNews.score !== undefined && (
              <div className="mb-4">
                <div className="text-xs text-muted-foreground mb-1">
                  Relevance Score: {Math.round(selectedNews.score * 100)}%
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-accent h-2 rounded-full transition-all"
                    style={{ width: `${selectedNews.score * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="prose prose-sm max-w-none mb-6">
              <p className="text-foreground whitespace-pre-wrap">
                {selectedNews.content}
              </p>
            </div>

            <a
              href={selectedNews.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
            >
              Read full article
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
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </div>
      )}
    </>
  );
}

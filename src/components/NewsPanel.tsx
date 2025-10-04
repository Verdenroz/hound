'use client';

interface NewsArticle {
  title: string;
  url: string;
  content: string;
  ticker?: string;
  score?: number;
}

interface NewsPanelProps {
  news: NewsArticle | null;
}

export function NewsPanel({ news }: NewsPanelProps) {
  if (!news) {
    return (
      <div className="bg-card rounded-lg p-6 border border-border">
        <h2 className="text-2xl font-bold mb-4">Current News</h2>
        <div className="flex items-center gap-3">
          <div className="animate-pulse flex gap-2">
            <div className="w-2 h-2 bg-accent rounded-full"></div>
            <div className="w-2 h-2 bg-accent rounded-full"></div>
            <div className="w-2 h-2 bg-accent rounded-full"></div>
          </div>
          <p className="text-muted-foreground">Monitoring for relevant news...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg p-6 border border-border">
      <h2 className="text-2xl font-bold mb-4">Current News</h2>

      <div>
        {news.ticker && (
          <div className="inline-block px-3 py-1 bg-accent/20 text-accent rounded-full text-sm font-semibold mb-3">
            {news.ticker}
          </div>
        )}

        <h3 className="font-bold text-lg mb-2">{news.title}</h3>

        <p className="text-muted-foreground text-sm mb-3 line-clamp-3">
          {news.content?.substring(0, 200)}...
        </p>

        {news.score !== undefined && (
          <div className="mb-3">
            <div className="text-xs text-muted-foreground mb-1">Relevance Score</div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-accent h-2 rounded-full transition-all"
                style={{ width: `${news.score * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        <a
          href={news.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:text-accent-hover hover:underline text-sm flex items-center gap-1"
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
  );
}

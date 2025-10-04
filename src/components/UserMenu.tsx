'use client';

import { useUser } from '@auth0/nextjs-auth0';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function UserMenu() {
  const { user, isLoading } = useUser();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <a
        href="/api/auth/login"
        className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors"
      >
        Login / Sign Up
      </a>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
      >
        {user.picture && (
          <img
            src={user.picture}
            alt={user.name || 'User'}
            className="w-8 h-8 rounded-full border border-border"
          />
        )}
        <svg
          className="w-4 h-4 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-20 py-1">
            {/* User Info */}
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>

            {/* Theme Toggle */}
            {mounted && (
              <div className="px-4 py-2 border-b border-border">
                <p className="text-xs text-muted-foreground mb-2">Theme</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex-1 px-3 py-2 text-xs rounded-md transition-colors ${
                      theme === 'light'
                        ? 'bg-accent text-white'
                        : 'bg-muted hover:bg-border'
                    }`}
                  >
                    ☀️ Light
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex-1 px-3 py-2 text-xs rounded-md transition-colors ${
                      theme === 'dark'
                        ? 'bg-accent text-white'
                        : 'bg-muted hover:bg-border'
                    }`}
                  >
                    🌙 Dark
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className={`flex-1 px-3 py-2 text-xs rounded-md transition-colors ${
                      theme === 'system'
                        ? 'bg-accent text-white'
                        : 'bg-muted hover:bg-border'
                    }`}
                  >
                    💻 Auto
                  </button>
                </div>
              </div>
            )}

            {/* Logout */}
            <a
              href="/api/auth/logout"
              className="block px-4 py-2 text-sm text-red-600 hover:bg-muted transition-colors"
            >
              Logout
            </a>
          </div>
        </>
      )}
    </div>
  );
}

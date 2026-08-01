import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const THEME_KEY = 'mlsc_theme';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';

  const storedTheme = window.localStorage.getItem(THEME_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const ThemeToggle = ({ className = '' }) => {
  const [theme, setTheme] = useState(getInitialTheme);
  const isDark = theme === 'dark';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [isDark, theme]);

  return (
    <button
      type="button"
      aria-pressed={isDark}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`group inline-flex h-10 items-center rounded-full border border-[#CBD5E1] bg-[#F8FAFC] px-1.5 text-[#334155] shadow-sm transition-colors hover:border-[#93C5FD] hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#0067B8]/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-blue-500/50 dark:hover:bg-slate-900 ${className}`}
    >
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-slate-200 transition-colors dark:bg-blue-500/25">
        <span
          className="absolute left-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#0067B8] shadow-sm transition-transform duration-200 ease-out dark:bg-blue-400 dark:text-slate-950"
          style={{ transform: `translateX(${isDark ? '20px' : '0px'})` }}
        >
          {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        </span>
      </span>
    </button>
  );
};

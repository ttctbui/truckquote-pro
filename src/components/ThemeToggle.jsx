import { useEffect, useState } from 'react';

/**
 * TTC Theme Toggle
 *
 * Drop-in component that toggles between light and dark themes.
 * Persists user preference in localStorage under key "ttc-theme".
 * Defaults to LIGHT theme (TTC standard).
 *
 * Relies on Tailwind's `darkMode: 'class'` config — toggles the
 * `dark` class on <html>.
 *
 * Usage:
 *   import ThemeToggle from './components/ThemeToggle';
 *   <ThemeToggle />
 */
export default function ThemeToggle({ className = '' }) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('ttc-theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    // No stored preference: default to LIGHT (TTC standard)
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      window.localStorage.setItem('ttc-theme', 'dark');
    } else {
      root.classList.remove('dark');
      window.localStorage.setItem('ttc-theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setIsDark(d => !d)}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-md text-white/90 hover:bg-white/10 transition-colors ${className}`}
    >
      {isDark ? (
        // Sun icon
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        // Moon icon
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

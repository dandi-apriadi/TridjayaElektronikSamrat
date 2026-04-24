import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme } from '../types';

const applyThemeClasses = (theme: Theme) => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.body.classList.toggle('light-mode', theme === 'light');
};

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';

  try {
    const savedTheme = localStorage.getItem('tridjaya-theme');
    if (!savedTheme) return 'dark';

    const parsed = JSON.parse(savedTheme) as { state?: { theme?: Theme } };
    return parsed.state?.theme === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

applyThemeClasses(getInitialTheme());

interface ThemeStore {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: getInitialTheme(),
      toggleTheme: () =>
        set((state) => {
          const newTheme = state.theme === 'dark' ? 'light' : 'dark';
          applyThemeClasses(newTheme);
          return { theme: newTheme };
        }),
      setTheme: (theme) => {
        applyThemeClasses(theme);
        set({ theme });
      },
    }),
    { name: 'tridjaya-theme' }
  )
);

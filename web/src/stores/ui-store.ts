import { create } from 'zustand';

export type ThemeChoice = 'system' | 'light' | 'dark';

interface UiState {
  theme: ThemeChoice;
  readingSerif: boolean;
  sidebarOpen: boolean;
  setTheme: (theme: ThemeChoice) => void;
  setReadingSerif: (on: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
}

const PREFS_KEY = 'tavern-ui-prefs';

function readPrefs(): Partial<Pick<UiState, 'theme' | 'readingSerif'>> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<UiState>;
  } catch {
    return {};
  }
}

function writePrefs(prefs: Pick<UiState, 'theme' | 'readingSerif'>) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // per-browser convenience only; safe to lose
  }
}

export function applyTheme(theme: ThemeChoice) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

const initial = readPrefs();

export const useUiStore = create<UiState>((set, get) => ({
  theme: initial.theme ?? 'system',
  readingSerif: initial.readingSerif ?? false,
  sidebarOpen: false,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
    writePrefs({ theme, readingSerif: get().readingSerif });
  },
  setReadingSerif: (readingSerif) => {
    set({ readingSerif });
    writePrefs({ theme: get().theme, readingSerif });
  },
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));

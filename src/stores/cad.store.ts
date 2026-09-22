/**
 * CAD State Store
 * 
 * Zustand store for CAD generation preferences and UI state
 * Persists user preferences to localStorage
 */

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { getLegacyStorageKey } from '@/lib/client-identity';
import { CADPreferences } from '@/types/cad.types';

interface CADState extends CADPreferences {
  // Actions
  setDefaultFormat: (format: CADPreferences['defaultFormat']) => void;
  setDefaultUnits: (units: CADPreferences['defaultUnits']) => void;
  setDefaultCategory: (category: CADPreferences['defaultCategory']) => void;
  addToRecentPrompts: (prompt: string) => void;
  clearRecentPrompts: () => void;
  resetPreferences: () => void;
}

const DEFAULT_PREFERENCES: CADPreferences = {
  defaultFormat: 'step',
  defaultUnits: 'mm',
  defaultCategory: 'custom',
  recentPrompts: [],
};

const METRA_PREFERENCES_KEY = 'metra-cad-preferences';
const legacyPreferencesKey = getLegacyStorageKey('cad-preferences', '-');

const migratedPreferencesStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null;

    try {
      const currentValue = window.localStorage.getItem(name);
      if (currentValue !== null || name !== METRA_PREFERENCES_KEY) {
        return currentValue;
      }

      const legacyValue = window.localStorage.getItem(legacyPreferencesKey);
      if (legacyValue !== null) {
        window.localStorage.setItem(METRA_PREFERENCES_KEY, legacyValue);
      }
      return legacyValue;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined' || name !== METRA_PREFERENCES_KEY) return;

    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Treat unavailable browser storage as an in-memory session.
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined' || name !== METRA_PREFERENCES_KEY) return;

    try {
      window.localStorage.removeItem(name);
    } catch {
      // Treat unavailable browser storage as an in-memory session.
    }
  },
};

/**
 * CAD Store
 * Manages user preferences and recent prompts
 */
export const useCADStore = create<CADState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,

      setDefaultFormat: (format) =>
        set({ defaultFormat: format }),

      setDefaultUnits: (units) =>
        set({ defaultUnits: units }),

      setDefaultCategory: (category) =>
        set({ defaultCategory: category }),

      addToRecentPrompts: (prompt) =>
        set((state) => {
          // Remove duplicates and limit to 10
          const newPrompts = [
            prompt,
            ...state.recentPrompts.filter((p) => p !== prompt),
          ].slice(0, 10);

          return { recentPrompts: newPrompts };
        }),

      clearRecentPrompts: () =>
        set({ recentPrompts: [] }),

      resetPreferences: () =>
        set(DEFAULT_PREFERENCES),
    }),
    {
      name: METRA_PREFERENCES_KEY,
      storage: createJSONStorage(() => migratedPreferencesStorage),
      partialize: (state) => ({
        defaultFormat: state.defaultFormat,
        defaultUnits: state.defaultUnits,
        defaultCategory: state.defaultCategory,
        recentPrompts: state.recentPrompts,
      }),
    }
  )
);







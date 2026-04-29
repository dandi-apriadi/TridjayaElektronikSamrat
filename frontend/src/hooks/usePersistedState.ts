import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

const STORAGE_PREFIX = 'tridjaya-page-state';

const readStoredValue = <T>(storageKey: string, fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const usePersistedState = <T>(
  key: string,
  initialState: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] => {
  const resolvedInitialState = useMemo(
    () => (typeof initialState === 'function' ? (initialState as () => T)() : initialState),
    [initialState]
  );

  const storageKey = `${STORAGE_PREFIX}:${key}`;

  const [state, setState] = useState<T>(() => readStoredValue(storageKey, resolvedInitialState));

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Ignore quota and serialization errors.
    }
  }, [state, storageKey]);

  return [state, setState];
};

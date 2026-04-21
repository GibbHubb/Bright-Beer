import { useCallback, useEffect, useState } from 'react';

/**
 * S7 — favourite venues backed by localStorage.
 *
 * Returns a stable {@link Set<string>} of venue IDs plus helpers. The set is
 * re-created on every write so React picks up the change, but reads are O(1).
 */
const STORAGE_KEY = 'bright-beer-favs';

function readFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function writeToStorage(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* quota exceeded or storage disabled — silently ignore */
  }
}

export function useFavourites() {
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(() => readFromStorage());

  // Sync to localStorage on every change
  useEffect(() => {
    writeToStorage(favouriteIds);
  }, [favouriteIds]);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setFavouriteIds(readFromStorage());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const isFavourite = useCallback(
    (id: string) => favouriteIds.has(id),
    [favouriteIds],
  );

  const toggleFavourite = useCallback((id: string) => {
    setFavouriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return { favouriteIds, isFavourite, toggleFavourite };
}

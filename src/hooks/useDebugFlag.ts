// S13 — true when the app should expose dev-only affordances. Triggered
// either by Vite's DEV mode (npm run dev) or the explicit ?debug=1 URL flag.

import { useEffect, useState } from 'react';

function readFlag(): boolean {
  if (import.meta.env?.DEV) return true;
  const params = new URLSearchParams(window.location.search);
  return params.get('debug') === '1';
}

export function useDebugFlag(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => readFlag());

  // Re-evaluate on URL changes (back/forward navigation, history.replaceState
  // doesn't fire popstate, but date pickers + filters use replaceState — we
  // only need this to catch true browser navigation).
  useEffect(() => {
    const onPop = () => setEnabled(readFlag());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return enabled;
}

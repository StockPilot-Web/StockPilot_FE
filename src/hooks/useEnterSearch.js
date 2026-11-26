import { useCallback, useState } from 'react';

/**
 * Keeps input state and active search query in sync so typing filters immediately,
 * while still supporting explicit `apply()` on Enter and `clear()`.
 */
export function useEnterSearch(initialValue = '') {
  const initial = String(initialValue || '').trim();
  const [draft, setDraftState] = useState(initial);
  const [query, setQuery] = useState(initial);

  const setDraft = useCallback((value) => {
    const nextRaw = typeof value === 'function' ? value(draft) : value;
    const str = String(nextRaw ?? '');
    setDraftState(str);
    const nextQuery = str.trim();
    setQuery((currentQuery) => (currentQuery === nextQuery ? currentQuery : nextQuery));
  }, [draft]);

  const apply = useCallback(() => {
    const nextQuery = draft.trim();
    setDraftState(nextQuery);
    setQuery((currentQuery) => (currentQuery === nextQuery ? currentQuery : nextQuery));
    return nextQuery;
  }, [draft]);

  const clear = useCallback(() => {
    setDraftState('');
    setQuery((currentQuery) => (currentQuery ? '' : currentQuery));
  }, []);

  return { draft, query, setDraft, apply, clear };
}

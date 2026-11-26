import { useCallback, useState } from 'react';

/**
 * Keeps the text being typed separate from the query currently applied to a list.
 * Consumers should use `query` for filtering/API requests and `draft` for the input.
 */
export function useEnterSearch(initialValue = '') {
  const initial = String(initialValue || '').trim();
  const [draft, setDraft] = useState(initial);
  const [query, setQuery] = useState(initial);

  const apply = useCallback(() => {
    const nextQuery = draft.trim();
    setDraft(nextQuery);
    setQuery((currentQuery) => (currentQuery === nextQuery ? currentQuery : nextQuery));
    return nextQuery;
  }, [draft]);

  const clear = useCallback(() => {
    setDraft('');
    setQuery((currentQuery) => (currentQuery ? '' : currentQuery));
  }, []);

  return { draft, query, setDraft, apply, clear };
}

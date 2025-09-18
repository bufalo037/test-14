import React, { createContext, useCallback, useContext, useState, useRef, useEffect } from 'react';

const DataContext = createContext();

export function DataProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // pagination/search state
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');

  const isMounted = useRef(false);

  useEffect(() => {
      isMounted.current = true; // mark mounted to true after mount on sideEffect
    return () => {
      isMounted.current = false; // prevent state updates after provider unmount
    };
  }, []);

  const fetchItems = useCallback(async ({ signal, page: p = 1, q = '', append = false } = {}) => {
    try {
      setError(null);
      setLoading(true);

      const params = new URLSearchParams({ page: String(p), limit: String(limit) });
      if (q) params.set('q', q);

      const res = await fetch(`http://localhost:3001/api/items?${params}`, { signal });
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);

      const json = await res.json(); // { items, total, page, limit }

      if (signal?.aborted || !isMounted.current) return;

      setTotal(json.total);
      setPage(json.page);
      setItems(json.items);
    } catch (e) {
      if (e.name !== 'AbortError' && isMounted.current) setError(e);
    } finally {
      if (!signal?.aborted && isMounted.current) setLoading(false);
    }
  }, [limit]);

  const search = useCallback((q) => {
    setQuery(q);
    setPage(1);
  }, []);

  const hasNextPage = items.length < total;

  return (
    <DataContext.Provider value={{ items, loading, error,
      page, limit, total, query, hasNextPage,
      fetchItems, search, setQuery }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
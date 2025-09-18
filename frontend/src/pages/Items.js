// src/pages/Items.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import { useData } from '../state/DataContext';
import '../css/Items.css';

// Debounce hook for search box
function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function Items() {
  const {
    items, loading, error,
    page, limit, total, query, hasNextPage,
    fetchItems, search,
  } = useData();

  const [qInput, setQInput] = useState(query);
  const debouncedQ = useDebouncedValue(qInput, 400);

  // Fetch on mount & when search changes
  useEffect(() => {
    const controller = new AbortController();
    fetchItems({ signal: controller.signal, page: 1, q: debouncedQ, append: false });
    search(debouncedQ);
    return () => controller.abort();
  }, [debouncedQ, fetchItems, search]);

  // Pagination handlers
  const goPrev = () => {
    if (page > 1 && !loading) {
      const controller = new AbortController();
      fetchItems({ signal: controller.signal, page: page - 1, q: debouncedQ, append: false });
    }
  };
  const goNext = () => {
    if (hasNextPage && !loading) {
      const controller = new AbortController();
      fetchItems({ signal: controller.signal, page: page + 1, q: debouncedQ, append: false });
    }
  };

  // Range info for a11y
  const from = items.length ? (page - 1) * limit + 1 : 0;
  const to = items.length ? (page - 1) * limit + items.length : 0;

  return (
    <div className="items-page">
      <h1 className="title">Items</h1>

      {/* Search + meta */}
      <div className="toolbar">
        <label htmlFor="search" className="sr-only">Search items</label>
        <input
          id="search"
          type="search"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Search by name or category…"
          className="search-input"
          aria-label="Search items"
        />
        <div className="count" aria-live="polite">
          {loading && items.length === 0
            ? 'Loading…'
            : total > 0
              ? `${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}`
              : '0 results'}
        </div>
      </div>

      {/* Error & empty states */}
      {error && <p role="alert" className="error">Error: {error.message}</p>}
      {!loading && items.length === 0 && !error && (
        <p className="empty">No items found.</p>
      )}

      {/* Virtualized list for the current page */}
      {items.length > 0 && (
        <div className="list-container" role="region" aria-label="Items results" style={{ height: 520 }}>
          <Virtuoso
            data={items}
            style={{ height: 520 }}
            itemContent={(index, item) => (
              <div className="row">
                <Link to={`/items/${item.id}`} className="item-link">
                  <span className="item-name">{item.name}</span>
                  <span className="item-meta">{item.category} • ${item.price}</span>
                </Link>
              </div>
            )}
          />
        </div>
      )}

      {/* Pagination controls */}
      <div className="pagination">
        <button
          type="button"
          onClick={goPrev}
          disabled={loading || page <= 1}
          aria-label="Previous page"
        >
          ← Prev
        </button>
        <span className="page-indicator" aria-live="polite">
          Page {page}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={loading || !hasNextPage}
          aria-label="Next page"
        >
          Next →
        </button>
      </div>

      {/* Screen-reader live region */}
      <div aria-live="polite" className="sr-only">
        {loading ? 'Loading results…' : ''}
      </div>
    </div>
  );
}
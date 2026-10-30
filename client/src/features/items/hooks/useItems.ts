import { useCallback, useEffect, useState } from "react";
import type { ItemDto, ListItemsQuery, PageMeta } from "@unah-red-tutores/shared";

import { itemsApi } from "../api";
import { normalizeApiError } from "../../../utils/api";

export type ItemsQuery = ListItemsQuery;

const DEFAULT_QUERY: ItemsQuery = {
  page: 1,
  pageSize: 20,
};

const EMPTY_META: PageMeta = {
  page: 1,
  pageSize: 20,
  total: 0,
};

export function useItems(initialQuery: Partial<ItemsQuery> = {}) {
  const [query, setQuery] = useState<ItemsQuery>({
    ...DEFAULT_QUERY,
    ...initialQuery,
  });
  const [data, setData] = useState<ItemDto[]>([]);
  const [meta, setMeta] = useState<PageMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  /** Refetch the current query; call after a mutation to invalidate the list. */
  const invalidate = useCallback(() => setVersion((value) => value + 1), []);

  const updateQuery = useCallback((patch: Partial<ItemsQuery>) => {
    setQuery((current) => ({ ...current, ...patch }));
  }, []);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    itemsApi
      .list(query)
      .then((response) => {
        if (!active) return;
        setData(response.data);
        setMeta(response.meta);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setData([]);
        setError(normalizeApiError(cause).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, version]);

  return {
    data,
    meta,
    query,
    loading,
    error,
    updateQuery,
    invalidate,
    retry: invalidate,
  };
}

export type UseItemsResult = ReturnType<typeof useItems>;

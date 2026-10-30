import { useCallback, useState } from "react";
import type { CreateItemRequest, UpdateItemRequest } from "@unah-red-tutores/shared";

import { itemsApi } from "../api";

export function useItemMutations(invalidate: () => void) {
  const [saving, setSaving] = useState(false);

  const run = useCallback(
    async <T>(action: () => Promise<T>): Promise<T> => {
      setSaving(true);
      try {
        const result = await action();
        invalidate();
        return result;
      } finally {
        setSaving(false);
      }
    },
    [invalidate],
  );

  return {
    saving,
    create: useCallback(
      (input: CreateItemRequest) => run(() => itemsApi.create(input)),
      [run],
    ),
    update: useCallback(
      (id: string, input: UpdateItemRequest) =>
        run(() => itemsApi.update(id, input)),
      [run],
    ),
    remove: useCallback((id: string) => run(() => itemsApi.remove(id)), [run]),
    restore: useCallback(
      (id: string) => run(() => itemsApi.restore(id)),
      [run],
    ),
  };
}

export type UseItemMutationsResult = ReturnType<typeof useItemMutations>;

import { useState } from "react";
import { App } from "antd";
import { useTranslation } from "react-i18next";
import type { ItemDto } from "@unah-red-tutores/shared";

import { normalizeApiError } from "../../../utils/api";
import { translateApiError } from "../../../i18n/errors";
import { useItemMutations } from "../hooks/useItemMutations";
import { useItems } from "../hooks/useItems";
import { ItemsTable } from "./ItemsTable";
import {
  ItemFormModal,
  type ItemFormMode,
  type ItemFormValues,
} from "./ItemFormModal";

type FormState = {
  mode: ItemFormMode;
  item?: ItemDto | null;
};

export function ItemsPage() {
  const { t } = useTranslation("items");
  const { t: tErrors } = useTranslation("errors");
  const { message } = App.useApp();
  const items = useItems();
  const mutations = useItemMutations(items.invalidate);
  const [formState, setFormState] = useState<FormState | null>(null);

  const reportError = (cause: unknown) => {
    const normalized = normalizeApiError(cause);
    message.error(translateApiError(tErrors, normalized));
  };

  const handleSubmit = async (values: ItemFormValues) => {
    try {
      if (formState?.mode === "edit" && formState.item) {
        await mutations.update(formState.item.id, values);
        message.success(t("messages.updateSuccess"));
      } else {
        await mutations.create({
          name: values.name ?? "",
          description: values.description,
        });
        message.success(t("messages.createSuccess"));
      }
      setFormState(null);
    } catch (cause) {
      reportError(cause);
    }
  };

  const handleDelete = async (item: ItemDto) => {
    try {
      await mutations.remove(item.id);
      message.success(t("messages.deleteSuccess"));
    } catch (cause) {
      reportError(cause);
    }
  };

  const handleRestore = async (item: ItemDto) => {
    try {
      await mutations.restore(item.id);
      message.success(t("messages.restoreSuccess"));
    } catch (cause) {
      reportError(cause);
    }
  };

  return (
    <>
      <ItemsTable
        data={items.data}
        meta={items.meta}
        query={items.query}
        loading={items.loading}
        error={items.error}
        saving={mutations.saving}
        onQueryChange={items.updateQuery}
        onRetry={items.retry}
        onCreate={() => setFormState({ mode: "create" })}
        onEdit={(item) => setFormState({ mode: "edit", item })}
        onDelete={handleDelete}
        onRestore={handleRestore}
      />

      <ItemFormModal
        open={formState !== null}
        mode={formState?.mode ?? "create"}
        item={formState?.item}
        loading={mutations.saving}
        onCancel={() => setFormState(null)}
        onSubmit={handleSubmit}
      />
    </>
  );
}

export default ItemsPage;

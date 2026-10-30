import type { ItemDto } from "@unah-red-tutores/shared";

type ItemRecord = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    deleted: boolean;
  } | null;
};

/** Map a database row to the public item shape. */
export function toItemDto(item: ItemRecord): ItemDto {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    status: item.status,
    createdAt:
      item.metadata?.createdAt.toISOString() ?? new Date(0).toISOString(),
    updatedAt:
      item.metadata?.updatedAt.toISOString() ?? new Date(0).toISOString(),
    deleted: item.metadata?.deleted ?? false,
  };
}

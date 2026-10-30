import type { PageMeta, Paginated } from "@unah-red-tutores/shared";

export type PaginationInput = {
  page: number;
  pageSize: number;
};

export function toPrismaPagination(input: PaginationInput): {
  skip: number;
  take: number;
} {
  return {
    skip: (input.page - 1) * input.pageSize,
    take: input.pageSize,
  };
}

export function paginated<T>(
  data: T[],
  total: number,
  input: PaginationInput,
): Paginated<T> {
  const meta: PageMeta = {
    page: input.page,
    pageSize: input.pageSize,
    total,
  };
  return { data, meta };
}

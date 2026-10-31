import { createHmac } from "node:crypto";

/**
 * Replace a unique natural key on soft delete with a one-way keyed hash.
 *
 * The original value is never stored, so the key can be reused by a new row
 * while the soft-deleted row stays unique.
 */
export function hashUniqueValue(
  secret: string,
  column: string,
  id: string,
  value: string,
): string {
  const digest = createHmac("sha256", secret)
    .update(`${column}:${id}:${value}`)
    .digest("hex");
  return `del:${digest}`;
}

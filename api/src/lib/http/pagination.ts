import { PaginationMeta, PaginationQuery } from "@/types/pagination.type";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100; // hard ceiling — prevents ?limit=999999 from being used to bypass pagination entirely

/**
 * Parses raw page/limit query params (strings or undefined) into safe,
 * bounded integers, and returns the corresponding TypeORM skip/take values.
 * Invalid/missing input silently falls back to defaults rather than erroring —
 * pagination params are a convenience, not something worth 400-ing over.
 */
export function parsePagination(raw: { page?: string | null; limit?: string | null }): {
  page: number;
  limit: number;
  skip: number;
  take: number;
} {
  let page = parseInt(raw.page ?? "", 10);
  let limit = parseInt(raw.limit ?? "", 10);

  if (!Number.isInteger(page) || page < 1) page = DEFAULT_PAGE;
  if (!Number.isInteger(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
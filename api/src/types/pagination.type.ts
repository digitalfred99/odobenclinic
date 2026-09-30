export type PaginationQuery = {
    page?: number;
    limit?: number;
};

export type PaginationMeta = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

export type PaginatedResult<TKey extends string, TItem> = {
    [key in TKey]: TItem[];
} & {
    pagination: PaginationMeta;
};
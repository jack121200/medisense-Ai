export interface PaginationParams {
    page: number;
    limit: number;
    skip: number;
}

export function getPagination(page?: string | number, limit?: string | number): PaginationParams {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 25));
    return { page: p, limit: l, skip: (p - 1) * l };
}

export function buildPaginationMeta(total: number, page: number, limit: number) {
    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
}

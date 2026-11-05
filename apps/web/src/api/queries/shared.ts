import { MAX_PAGE_SIZE, type PaginationQuery } from "@jobpilot/contracts/pagination";

/**
 * A read that feeds a `<Select>` wants the whole (small) collection, not a page of it. One page at
 * the API's cap is that read, and it stays bounded.
 */
export const OPTIONS_PAGE: PaginationQuery = { page: 1, limit: MAX_PAGE_SIZE };

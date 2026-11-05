import { MAX_PAGE_SIZE, type PaginationQuery } from "@jobpilot/contracts/pagination";

/** The whole small collection, as one page at the API's cap. */
export const FULL_PAGE: PaginationQuery = { page: 1, limit: MAX_PAGE_SIZE };

// data-table stays out of the barrel: re-exporting it would make @mui/x-data-grid
// reachable from every EmptyState/PaginationFooter importer, including the root
// client chunk. Grid call sites import "@/components/ui/data/data-table" directly.
export * from "./detail-skeleton";
export * from "./empty-state";
export * from "./pagination-controls";
export * from "./pagination-footer";
export * from "./query-section";
export * from "./table-skeleton";

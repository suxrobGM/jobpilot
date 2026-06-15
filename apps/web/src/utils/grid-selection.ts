import type { GridRowSelectionModel } from "@mui/x-data-grid";

/** A DataGrid selection model with nothing selected. */
export const EMPTY_SELECTION: GridRowSelectionModel = { type: "include", ids: new Set() };

/**
 * Resolve a DataGrid selection model to the matching rows. `include` matches
 * against `all`; `exclude` (select-all-across-pages) matches `visible`
 * (defaulting to `all`) minus the explicitly excluded ids.
 */
export function resolveSelectedRows<T extends { id: number }>(
  model: GridRowSelectionModel,
  all: ReadonlyArray<T>,
  visible: ReadonlyArray<T> = all,
): T[] {
  return model.type === "include"
    ? all.filter((r) => model.ids.has(r.id))
    : visible.filter((r) => !model.ids.has(r.id));
}

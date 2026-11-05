import type { GridRowSelectionModel } from "@mui/x-data-grid";

export const EMPTY_SELECTION: GridRowSelectionModel = { type: "include", ids: new Set() };

/** `exclude` is select-all-across-pages, so it resolves against `visible` minus the excluded ids. */
export function resolveSelectedRows<T extends { id: string }>(
  model: GridRowSelectionModel,
  all: ReadonlyArray<T>,
  visible: ReadonlyArray<T> = all,
): T[] {
  return model.type === "include"
    ? all.filter((r) => model.ids.has(r.id))
    : visible.filter((r) => !model.ids.has(r.id));
}

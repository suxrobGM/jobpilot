"use client";

import { useRef } from "react";
import { moveAt, removeAt } from "@/utils/array";

let counter = 0;

const nextKey = (): string => `row${++counter}`;

export interface KeyedList {
  /** One stable key per row, positionally aligned with the source array. */
  keys: readonly string[];
  onMove: (idx: number, dir: -1 | 1) => void;
  onRemove: (idx: number) => void;
  onAdd: () => void;
}

/** Keys for id-less rows, so a row keeps its focus on reorder. Call `on*` beside each mutation. */
export function useKeyedList(length: number): KeyedList {
  const keys = useRef<string[]>([]);

  // Resync when the parent swapped the array wholesale (load, reset, rejected add).
  while (keys.current.length < length) {
    keys.current.push(nextKey());
  }
  keys.current.length = length;

  return {
    keys: keys.current,
    onMove: (idx, dir) => {
      keys.current = moveAt(keys.current, idx, dir);
    },
    onRemove: (idx) => {
      keys.current = removeAt(keys.current, idx);
    },
    onAdd: () => {
      keys.current.push(nextKey());
    },
  };
}

"use client";

import { useToast } from "@/providers/notification-provider";

/** Copies text to the clipboard and confirms it with a toast. */
export function useCopy(): (text: string, message?: string) => Promise<void> {
  const toast = useToast();
  return async (text, message = "Copied") => {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  };
}

"use client";

import { useEffect, useState } from "react";

const TEXT_FIELD =
  "textarea, [contenteditable='true'], input:not([type=checkbox], [type=radio], [type=button], [type=submit], [type=range], [type=file])";

/** True while a text field has focus, which on a phone means the keyboard is up. */
export function useTyping(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const onFocusIn = (event: FocusEvent): void => {
      setTyping(event.target instanceof Element && event.target.matches(TEXT_FIELD));
    };
    const onFocusOut = (): void => setTyping(false);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return typing;
}

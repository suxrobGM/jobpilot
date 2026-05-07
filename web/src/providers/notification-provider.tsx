"use client";

import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from "react";
import { Alert, Snackbar } from "@mui/material";

type ToastSeverity = "success" | "info" | "warning" | "error";

type Toast = {
  id: number;
  message: string;
  severity: ToastSeverity;
};

type ToastApi = {
  show: (message: string, severity?: ToastSeverity) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function NotificationProvider(props: PropsWithChildren): ReactElement {
  const { children } = props;
  const [toast, setToast] = useState<Toast | null>(null);

  const show = (message: string, severity: ToastSeverity = "info") => {
    setToast({ id: Date.now(), message, severity });
  };

  const api: ToastApi = {
    show,
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error"),
    info: (m) => show(m, "info"),
    warning: (m) => show(m, "warning"),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        {toast ? (
          <Alert
            onClose={() => setToast(null)}
            severity={toast.severity}
            variant="filled"
            sx={{ minWidth: 280 }}
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside NotificationProvider");
  return ctx;
}

import "./globals.css";
import type { PropsWithChildren, ReactElement } from "react";
import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { AgentProvider } from "@/providers/agent-provider";
import { ConfirmProvider } from "@/providers/confirm-provider";
import { ToastProvider } from "@/providers/notification-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";

// Body + display (the display role widens to the expanded width axis via fontStretch).
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
  axes: ["wdth"],
});

// Mono for stat values, tabular numerics, and the terminal.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JobPilot",
  description: "Local control center for AI-driven job applications",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout(props: PropsWithChildren): ReactElement {
  const { children } = props;
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${jetbrainsMono.variable}`}
    >
      <body suppressHydrationWarning>
        <ThemeProvider>
          <QueryProvider>
            <ToastProvider>
              <ConfirmProvider>
                <AgentProvider>{children}</AgentProvider>
              </ConfirmProvider>
            </ToastProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

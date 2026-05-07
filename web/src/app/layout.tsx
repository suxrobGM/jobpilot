import "./globals.css";
import type { Metadata } from "next";
import type { PropsWithChildren, ReactElement } from "react";
import { NotificationProvider } from "@/providers/notification-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";

export const metadata: Metadata = {
  title: "JobPilot",
  description: "Local control center for AI-driven job applications",
};

export default function RootLayout(props: PropsWithChildren): ReactElement {
  const { children } = props;
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <QueryProvider>
            <NotificationProvider>{children}</NotificationProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

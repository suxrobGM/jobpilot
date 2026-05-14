import "./globals.css";
import type { PropsWithChildren, ReactElement } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationProvider } from "@/providers/notification-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JobPilot",
  description: "Local control center for AI-driven job applications",
};

export default function RootLayout(props: PropsWithChildren): ReactElement {
  const { children } = props;
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <QueryProvider>
            <NotificationProvider>
              <AppShell>{children}</AppShell>
            </NotificationProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

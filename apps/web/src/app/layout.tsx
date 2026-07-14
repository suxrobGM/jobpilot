import "./globals.css";
import type { PropsWithChildren, ReactElement } from "react";
import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/constants";
import { AgentProvider } from "@/providers/agent-provider";
import { ConfirmProvider } from "@/providers/confirm-provider";
import { ToastProvider } from "@/providers/notification-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { surfaces } from "@/theme/palette";

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

const description =
  "JobPilot drives Claude Code or Codex on your own subscription to search any job board - 12 built in - tailor your resume, apply, and track every reply from one dashboard.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "JobPilot - your AI job agent", template: "%s · JobPilot" },
  description,
  applicationName: "JobPilot",
  keywords: [
    "AI job application",
    "job search agent",
    "Claude Code",
    "Codex",
    "resume tailoring",
    "auto apply jobs",
    "Upwork proposals",
    "job board automation",
  ],
  authors: [{ name: "Sukhrob Ilyosbekov", url: "https://github.com/suxrobGM" }],
  creator: "Sukhrob Ilyosbekov",
  category: "technology",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    siteName: "JobPilot",
    url: "/",
    type: "website",
    locale: "en_US",
    title: "JobPilot - your AI job agent",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "JobPilot - your AI job agent",
    description,
  },
};

export const viewport: Viewport = {
  themeColor: surfaces.base,
  colorScheme: "dark",
};

export default function RootLayout(props: PropsWithChildren): ReactElement {
  const { children } = props;
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrainsMono.variable}`}>
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

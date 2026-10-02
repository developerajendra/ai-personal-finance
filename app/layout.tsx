import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/shared/providers/Providers";
import { THEME_BOOT_SCRIPT } from "@/shared/providers/ThemeProvider";

export const metadata: Metadata = {
  title: "Ledger · Personal Finance",
  description: "Comprehensive personal finance management tool with AI insights",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="apple" data-skin="apple" data-accent="teal" suppressHydrationWarning>
      <head>
        {/* Applies the saved skin/accent before first paint so there is no theme flash */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {/* Only the Private skin uses web fonts; every other skin uses the system SF stack */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- root layout, so this loads on every page */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Source+Serif+4:wght@600&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

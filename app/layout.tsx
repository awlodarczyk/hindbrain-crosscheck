import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { inter, jetbrainsMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "hindbrain crosscheck",
  description: "Ask once. Two models answer, then check each other claim by claim.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

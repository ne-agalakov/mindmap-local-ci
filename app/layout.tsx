import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MindMap — персональная система мышления",
  description: "Локальная система для фиксации, понимания и связывания мыслей.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

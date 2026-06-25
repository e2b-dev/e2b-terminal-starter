import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "E2B Terminal Starter",
  description: "Per-user terminal sessions backed by E2B sandboxes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

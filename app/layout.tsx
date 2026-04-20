import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calm Sky Explorer",
  description:
    "A calming mobile-first flight discovery app for finding nearby aircraft and quietly wondering where they are headed.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

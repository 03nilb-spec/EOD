import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI EOD Report Generator",
  description: "Generate professional end-of-day work updates for Slack, Teams, and email."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bastion Law — Owner Portal",
  description: "Firm management for Bastion Law",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}

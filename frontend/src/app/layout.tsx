import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { NetworkStatusNotice } from "@/components/providers/network-status-notice";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"),
  title: "Odoben Health Center",
  description: "Patient registration and OPD visit system",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "Odoben Health Center",
    title: "Odoben Health Center",
    description: "Patient registration and OPD visit system",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Odoben Health Center patient registration and OPD visit system" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Odoben Health Center",
    description: "Patient registration and OPD visit system",
    images: ["/opengraph-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full bg-background text-foreground">
        <QueryProvider>
          <AuthProvider>
            {children}
            <NetworkStatusNotice />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

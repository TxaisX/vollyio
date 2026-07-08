import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  preload: false,
});

const description =
  "Record a rep, get frame-by-frame form analysis for every volleyball skill.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Sideout — Volleyball Form Coach", template: "%s — Sideout" },
  description,
  applicationName: "Sideout",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Sideout" },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Sideout",
    title: "Sideout — Volleyball Form Coach",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Sideout — Volleyball Form Coach",
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f212c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${instrument.variable} ${spaceGrotesk.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}

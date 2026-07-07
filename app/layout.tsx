import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Sideout — Volleyball Form Coach",
  description:
    "Record a rep, get frame-by-frame form analysis for every volleyball skill.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Sideout" },
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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
  title: { default: "Vollyio · Volleyball Form Coach", template: "%s · Vollyio" },
  description,
  applicationName: "Vollyio",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Vollyio" },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Vollyio",
    title: "Vollyio · Volleyball Form Coach",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Vollyio · Volleyball Form Coach",
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
      // The inline script below stamps .js before hydration; suppress only
      // this element's own class-attribute mismatch.
      suppressHydrationWarning
    >
      <head>
        {/* Runs before first paint so .reveal's hidden pre-state (scoped to
            :root.js in globals.css) never applies for no-JS visitors. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
      </head>
      {/* Browser extensions (e.g. Grammarly) inject attributes on <body> before
          React hydrates; suppress only this element's own attribute mismatch. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <PwaRegister />
        {children}
        <Analytics />
      </body>
    </html>
  );
}

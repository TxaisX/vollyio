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

// The single most-seen string in the product: the meta description on every
// page that does not set its own, and the OpenGraph card that unfurls wherever
// a share link gets posted. It promised per-frame analysis until 2026-08-11,
// which the engine cannot do - the video path samples roughly one frame a
// second and `/api/analyze` sets `timeAt = () => null`.
//
// Third surface to survive the 6e351ba sweep, after `app/manifest.ts` and the
// JSON-LD in `app/page.tsx`. The pattern is worth naming: that sweep rewrote
// what a PERSON reads and missed every string a MACHINE reads, and the
// machine-read ones travel further, because they reach a search result, an
// answer engine and an install prompt before anyone opens the site.
const description =
  "Record a rep, get it scored 0-100 against the checkpoints for that skill, with the one fix that matters most.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Vollyio · Volleyball Form Coach", template: "%s · Vollyio" },
  description,
  applicationName: "Vollyio",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Vollyio" },
  // NO canonical here. A canonical in the root layout is inherited by every
  // page that does not override it, which told crawlers that /learn, /drills,
  // and every drill and skill page were duplicates of the homepage. Each
  // indexable page declares its own canonical instead.
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
            :root.js in globals.css) never applies for no-JS visitors.

            It also catches `beforeinstallprompt`, and that HAS to happen here
            rather than in components/install-app.tsx. The browser fires the
            event once, early, and usually before React has hydrated, so a
            listener added in a component effect misses it on most visits and
            the Install button never appears. Stashing it on `window` lets the
            component read it whenever it mounts, and the custom event covers
            the rarer case where the browser fires late. preventDefault stops
            Chrome's own mini-infobar so the page owns the offer. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.classList.add('js');" +
              // Theme, applied before first paint so a player who chose dark
              // never sees a white flash on the way to it. Light is the
              // default and the OS preference is deliberately NOT consulted
              // (D-126): dark is a choice made here, not one inherited.
              "try{var t=localStorage.getItem('vollyio.theme');" +
              "if(t==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}" +
              "window.__installPrompt=null;" +
              "addEventListener('beforeinstallprompt',function(e){" +
              "e.preventDefault();window.__installPrompt=e;" +
              "dispatchEvent(new Event('vollyio:installready'))});" +
              "addEventListener('appinstalled',function(){" +
              "window.__installPrompt=null;" +
              "dispatchEvent(new Event('vollyio:installed'))});",
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

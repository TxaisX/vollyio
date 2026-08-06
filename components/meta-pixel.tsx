import Script from "next/script";

// The browser half of conversion reporting. Renders NOTHING unless a pixel id
// is configured, so local dev, preview deploys, and any environment that has
// not opted in ship no third-party script at all: there is no tag to block, no
// cookie to set, and no request to the ad network.
//
// Deliberately no automatic PageView beyond the one the base snippet fires, and
// deliberately no advanced matching. Advanced matching is the setting that
// scrapes email and phone values out of form fields on the page and sends them
// hashed to the ad network; it is on by default in the platform's own setup
// wizard and it is exactly what lib/meta/events.ts refuses to do. If someone
// enables it in the Events Manager UI later, this file's guarantee is void:
// the toggle lives in their dashboard, not in this repo.
export function MetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('set','autoConfig',false,'${pixelId}');
fbq('init','${pixelId}');
fbq('track','PageView');`}
    </Script>
  );
}

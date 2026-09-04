"use client";

import { useEffect, useState } from "react";
import { getStoredConsent, type ConsentValue } from "@/components/consent/cookie-consent";

function injectScript(id: string, src?: string, inline?: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  if (src) {
    s.async = true;
    s.src = src;
  }
  if (inline) s.text = inline;
  document.head.appendChild(s);
}

function loadAnalytics() {
  const ga = process.env.NEXT_PUBLIC_GA_ID?.trim();
  const meta = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();

  if (ga) {
    injectScript("ga-gtag", `https://www.googletagmanager.com/gtag/js?id=${ga}`);
    injectScript(
      "ga-inline",
      undefined,
      `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');`
    );
  }

  if (meta) {
    injectScript(
      "meta-pixel",
      undefined,
      `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');fbq('init','${meta}');fbq('track','PageView');`
    );
  }
}

export function TrackingPixels() {
  const [consent, setConsent] = useState<ConsentValue | null>(null);

  useEffect(() => {
    setConsent(getStoredConsent());
    function onConsent(e: Event) {
      const detail = (e as CustomEvent<ConsentValue>).detail;
      setConsent(detail);
    }
    window.addEventListener("alpainoo-consent", onConsent);
    return () => window.removeEventListener("alpainoo-consent", onConsent);
  }, []);

  useEffect(() => {
    if (consent === "accepted") loadAnalytics();
  }, [consent]);

  return null;
}

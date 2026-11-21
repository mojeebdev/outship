"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "outship.privacy-consent.v1";
const CONSENT_DAYS = 180;
const CONSENT_VERSION = 1;
const consentSubscribers = new Set<() => void>();
let memoryChoice: string | null = null;

type ConsentChoice = {
  version: number;
  analytics: boolean;
  expiresAt: number;
};

function parseChoice(raw: string | null): ConsentChoice | null {
  if (!raw) return null;
  try {
    const choice = JSON.parse(raw) as Partial<ConsentChoice>;
    if (
      choice.version !== CONSENT_VERSION ||
      typeof choice.analytics !== "boolean" ||
      typeof choice.expiresAt !== "number" ||
      choice.expiresAt <= Date.now()
    ) {
      return null;
    }
    return choice as ConsentChoice;
  } catch {
    return null;
  }
}

function subscribeToConsent(callback: () => void) {
  consentSubscribers.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    consentSubscribers.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getConsentSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memoryChoice;
  } catch {
    return memoryChoice;
  }
}

function getServerConsentSnapshot(): string | null {
  return null;
}

function notifyConsentChange() {
  for (const callback of consentSubscribers) callback();
}

function subscribeToHydration() {
  return () => {};
}

function getHydrationSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}

export function AnalyticsConsent({ token }: { token: string | null }) {
  const hydrated = useSyncExternalStore(subscribeToHydration, getHydrationSnapshot, getServerHydrationSnapshot);
  const consentRaw = useSyncExternalStore(subscribeToConsent, getConsentSnapshot, getServerConsentSnapshot);
  const choice = parseChoice(consentRaw);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [analyticsDraft, setAnalyticsDraft] = useState(false);

  useEffect(() => {
    const openPreferences = () => {
      const latest = parseChoice(getConsentSnapshot());
      setAnalyticsDraft(latest?.analytics ?? false);
      setPreferencesOpen(true);
    };
    window.addEventListener("outship:privacy-choices", openPreferences);
    return () => window.removeEventListener("outship:privacy-choices", openPreferences);
  }, []);

  function saveChoice(allowAnalytics: boolean) {
    const previous = parseChoice(getConsentSnapshot());
    const analytics = Boolean(token && allowAnalytics);
    const next: ConsentChoice = {
      version: CONSENT_VERSION,
      analytics,
      expiresAt: Date.now() + CONSENT_DAYS * 24 * 60 * 60 * 1000,
    };
    const serialized = JSON.stringify(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      // Keep the explicit choice for this page session if browser storage is unavailable.
      memoryChoice = serialized;
    }
    notifyConsentChange();
    setPreferencesOpen(false);
    if (previous?.analytics && !analytics) window.location.reload();
  }

  if (!hydrated) return null;

  return (
    <>
      {choice?.analytics && token && (
        <Script
          id="outship-cloudflare-web-analytics"
          src="https://static.cloudflareinsights.com/beacon.min.js"
          strategy="afterInteractive"
          data-cf-beacon={JSON.stringify({ token })}
        />
      )}

      {((Boolean(token) && !choice) || preferencesOpen) && (
        <aside
          aria-label="Privacy choices"
          className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-5 sm:pb-5"
        >
          <div className="mx-auto max-w-3xl rounded-xl border border-border bg-white p-4 shadow-[0_12px_48px_rgba(0,0,0,.18)] sm:p-5">
            {preferencesOpen ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.16em] text-base-blue">your privacy</p>
                    <h2 className="mt-1 text-lg font-medium">cookies and analytics choices</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-5 text-text-muted-1">
                      Outship keeps sign-in storage on so your account works. Optional analytics is off unless you turn it on.
                    </p>
                  </div>
                  {choice && <button type="button" onClick={() => setPreferencesOpen(false)} className="shrink-0 rounded px-2 py-1 text-sm text-text-muted-1 hover:text-void">close</button>}
                </div>

                <div className="divide-y divide-border rounded-lg border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
                    <span><strong className="font-medium">necessary</strong><span className="ml-2 text-text-muted-1">sign-in, install prompt, and privacy preference storage</span></span>
                    <span className="text-xs font-medium text-text-muted-1">always on</span>
                  </div>
                  <label htmlFor="outship-analytics-choice" className="flex cursor-pointer items-center justify-between gap-4 px-3 py-3 text-sm">
                    <span className="min-w-0"><strong className="font-medium">Cloudflare Web Analytics</strong><span className="mt-1 block text-xs leading-5 text-text-muted-1">Cookieless page counts, referring site, rough country, and device type. No advertising or cross-site tracking.</span></span>
                    <input
                      id="outship-analytics-choice"
                      type="checkbox"
                      checked={analyticsDraft && Boolean(token)}
                      disabled={!token}
                      onChange={(event) => setAnalyticsDraft(event.target.checked)}
                      className="h-4 w-4 shrink-0 accent-base-blue"
                    />
                  </label>
                </div>
                {!token && <p className="text-xs text-text-muted-2">Optional analytics is not active on this site.</p>}
                {choice?.analytics && <p className="text-xs text-text-muted-2">Turning analytics off reloads this page so the beacon stops.</p>}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => choice ? setPreferencesOpen(false) : saveChoice(false)} className="min-h-10 rounded-md border border-border px-4 text-sm font-medium transition hover:border-base-blue">cancel</button>
                  <button type="button" onClick={() => saveChoice(analyticsDraft)} className="min-h-10 rounded-md bg-base-blue px-4 text-sm font-medium text-white transition hover:opacity-90">save choices</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-xl">
                  <h2 className="text-base font-medium">your privacy choices</h2>
                  <p className="mt-1 text-sm leading-5 text-text-muted-1">
                    Outship is run by BlindspotLab Limited. Optional Cloudflare analytics counts page views, referrers, rough country, and device type without cookies. It stays off unless you allow it; your choice is saved in this browser for 180 days. Change it any time with privacy choices in the footer. <Link href="/privacy" className="underline decoration-border underline-offset-2 hover:text-base-blue">Read the privacy policy.</Link>
                  </p>
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-[19rem]">
                  <button type="button" onClick={() => saveChoice(false)} className="min-h-10 rounded-md border border-border bg-white px-3 text-sm font-medium transition hover:border-base-blue">reject analytics</button>
                  <button type="button" onClick={() => saveChoice(true)} disabled={!token} className="min-h-10 rounded-md border border-border bg-white px-3 text-sm font-medium transition hover:border-base-blue disabled:cursor-not-allowed disabled:opacity-50">allow analytics</button>
                  <button type="button" onClick={() => { setAnalyticsDraft(false); setPreferencesOpen(true); }} className="col-span-2 min-h-8 text-xs text-text-muted-1 underline underline-offset-2 hover:text-base-blue">change preferences</button>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </>
  );
}

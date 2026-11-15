import { WEB_ANALYTICS_TOKEN } from "@/lib/web-analytics";

// Visitor numbers from Cloudflare Web Analytics, read with Cloudflare's
// GraphQL API for the admin panel. The beacon on the site is cookieless: it
// records page loads, not people. Configured with:
//   CLOUDFLARE_ANALYTICS_TOKEN  secret, an API token with Account Analytics: Read
//   CLOUDFLARE_ACCOUNT_ID       the account id (in wrangler.jsonc vars)
//   CF_WEB_ANALYTICS_SITE_TAG   optional: the Web Analytics site's tag. When it
//                               isn't set, it's looked up from the beacon's
//                               public token (src/lib/web-analytics.ts).
// Without the token the admin panel shows how to set it up instead.

export type CfAnalytics =
  | { configured: false }
  | {
      configured: true;
      error?: string;
      /** The window actually queried (Web Analytics answers at most ~31 days at a time). */
      clampedToDays?: number;
      pageViews: number;
      visits: number;
      previousPageViews: number;
      previousVisits: number;
      pages: { label: string; value: number }[];
      referrers: { label: string; value: number }[];
      countries: { label: string; value: number }[];
      devices: { label: string; value: number }[];
    };

const MAX_RANGE_MS = 31 * 86_400_000;

// The site tag for a beacon token, per isolate: it never changes.
const siteTagCache = new Map<string, string>();

/**
 * The Web Analytics site tag that belongs to a beacon token, from Cloudflare's
 * list of the account's sites. Null if the token can't list them (the API
 * token then needs Account Analytics: Read, as for the queries themselves).
 */
async function siteTagFor(account: string, apiToken: string, beaconToken: string): Promise<string | null> {
  const cached = siteTagCache.get(beaconToken);
  if (cached) return cached;
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/rum/site_info/list?per_page=100`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { result?: { site_tag?: string; site_token?: string }[] };
  const site = json.result?.find((entry) => entry.site_token === beaconToken);
  if (!site?.site_tag) return null;
  siteTagCache.set(beaconToken, site.site_tag);
  return site.site_tag;
}

const QUERY = `query($account: String!, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!, $previous: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      totals: rumPageloadEventsAdaptiveGroups(limit: 1, filter: $filter) { count sum { visits } }
      previous: rumPageloadEventsAdaptiveGroups(limit: 1, filter: $previous) { count sum { visits } }
      pages: rumPageloadEventsAdaptiveGroups(limit: 8, orderBy: [count_DESC], filter: $filter) { count dimensions { requestPath } }
      referrers: rumPageloadEventsAdaptiveGroups(limit: 8, orderBy: [count_DESC], filter: $filter) { count dimensions { refererHost } }
      countries: rumPageloadEventsAdaptiveGroups(limit: 8, orderBy: [count_DESC], filter: $filter) { count dimensions { countryName } }
      devices: rumPageloadEventsAdaptiveGroups(limit: 5, orderBy: [count_DESC], filter: $filter) { count dimensions { deviceType } }
    }
  }
}`;

type Group = { count?: number; sum?: { visits?: number }; dimensions?: Record<string, string> };

const ranked = (groups: Group[] | undefined, field: string) =>
  (groups ?? []).map((group) => ({ label: group.dimensions?.[field] || "(none)", value: Number(group.count ?? 0) }));

export async function loadCfAnalytics(
  env: { CLOUDFLARE_ANALYTICS_TOKEN?: string; CLOUDFLARE_ACCOUNT_ID?: string; CF_WEB_ANALYTICS_SITE_TAG?: string },
  range: { start: Date; end: Date },
): Promise<CfAnalytics> {
  const token = env.CLOUDFLARE_ANALYTICS_TOKEN;
  const account = env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) return { configured: false };

  const length = range.end.getTime() - range.start.getTime();
  const clamped = length > MAX_RANGE_MS;
  const start = clamped ? new Date(range.end.getTime() - MAX_RANGE_MS) : range.start;
  const span = range.end.getTime() - start.getTime();
  const previousStart = new Date(start.getTime() - span);
  const empty = { pageViews: 0, visits: 0, previousPageViews: 0, previousVisits: 0, pages: [], referrers: [], countries: [], devices: [] };

  let site = env.CF_WEB_ANALYTICS_SITE_TAG ?? null;
  if (!site && WEB_ANALYTICS_TOKEN) site = await siteTagFor(account, token, WEB_ANALYTICS_TOKEN).catch(() => null);
  if (!site) {
    return {
      configured: true,
      error: "couldn't find the web analytics site for this beacon token: set CF_WEB_ANALYTICS_SITE_TAG, or give the API token Account Analytics: Read",
      ...empty,
    };
  }

  try {
    const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          account,
          filter: { siteTag: site, datetime_geq: start.toISOString(), datetime_lt: range.end.toISOString() },
          previous: { siteTag: site, datetime_geq: previousStart.toISOString(), datetime_lt: start.toISOString() },
        },
      }),
    });
    const json = (await response.json()) as {
      data?: { viewer?: { accounts?: Record<string, Group[]>[] } };
      errors?: { message?: string }[] | null;
    };
    if (!response.ok || json.errors?.length) {
      return { configured: true, error: json.errors?.[0]?.message ?? `Cloudflare answered ${response.status}`, ...empty };
    }
    const data = json.data?.viewer?.accounts?.[0] ?? {};
    return {
      configured: true,
      ...(clamped ? { clampedToDays: 31 } : {}),
      pageViews: Number(data.totals?.[0]?.count ?? 0),
      visits: Number(data.totals?.[0]?.sum?.visits ?? 0),
      previousPageViews: Number(data.previous?.[0]?.count ?? 0),
      previousVisits: Number(data.previous?.[0]?.sum?.visits ?? 0),
      pages: ranked(data.pages, "requestPath"),
      referrers: ranked(data.referrers, "refererHost"),
      countries: ranked(data.countries, "countryName"),
      devices: ranked(data.devices, "deviceType"),
    };
  } catch (error) {
    return { configured: true, error: error instanceof Error ? error.message : "couldn't reach Cloudflare", ...empty };
  }
}

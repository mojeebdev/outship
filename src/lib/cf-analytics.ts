// Visitor numbers from Cloudflare Web Analytics, read with Cloudflare's
// GraphQL API for the admin panel. The beacon on the site is cookieless: it
// records page loads, not people. Configured with three Worker settings:
//   CLOUDFLARE_ANALYTICS_TOKEN  secret, an API token with Account Analytics: Read
//   CLOUDFLARE_ACCOUNT_ID       the account id (in the dashboard URL)
//   CF_WEB_ANALYTICS_SITE_TAG   the Web Analytics site's tag
// Without them the admin panel shows how to set it up instead.

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
  const site = env.CF_WEB_ANALYTICS_SITE_TAG;
  if (!token || !account || !site) return { configured: false };

  const length = range.end.getTime() - range.start.getTime();
  const clamped = length > MAX_RANGE_MS;
  const start = clamped ? new Date(range.end.getTime() - MAX_RANGE_MS) : range.start;
  const span = range.end.getTime() - start.getTime();
  const previousStart = new Date(start.getTime() - span);
  const empty = { pageViews: 0, visits: 0, previousPageViews: 0, previousVisits: 0, pages: [], referrers: [], countries: [], devices: [] };

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

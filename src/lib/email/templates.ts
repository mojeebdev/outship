import { BARE_RELEASE_POINTS, DAILY_CAPS, STREAK_POINTS_PER_DAY, MERGE_POINTS, PUSH_POINTS, RELEASE_POINTS, REVIEWED_MERGE_POINTS } from "@/lib/score";
import { GITHUB_APP_INSTALL_URL } from "@/lib/github-app";
import { SITE_URL, type Email } from "./send";

const BLUE = "#0000ff";
const VOID = "#000000";
const CREAM = "#f5f5f0";
const MUTED = "#666666";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${BLUE};color:#ffffff;text-decoration:none;font-weight:500;padding:12px 22px;border-radius:6px">${escapeHtml(label)}</a>`;
}

// The real outship mark (bars breaking into a point) as a PNG on a white tile:
// Gmail and Outlook don't show SVG, and the tile keeps the black bars visible
// when a mail app switches to dark mode. Served from the site, 3x for sharpness.
const LOGO_URL = `${SITE_URL}/brand/email-mark.png`;
const HEADER = `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:10px;vertical-align:middle"><img src="${LOGO_URL}" width="32" height="32" alt="" style="display:block;border:0;width:32px;height:32px"></td>
<td style="vertical-align:middle;font-size:18px;font-weight:600;color:${VOID}">outship</td>
</tr></table>`;

/** The shared frame. `footer` is already-safe HTML. */
function layout(bodyHtml: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:${CREAM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${VOID}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e0e0e0;border-radius:8px">
<tr><td style="padding:28px 28px 0">${HEADER}</td></tr>
<tr><td style="padding:16px 28px 28px;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
</table>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:${MUTED}">${footer}</p>
</td></tr></table></body></html>`;
}

const STANDARD_FOOTER = `outship, a BlindspotLab product. reply to this email and it reaches a real person.`;

const POINTS_LINE = `a release with notes or files ${RELEASE_POINTS} points (a bare tag ${BARE_RELEASE_POINTS}), a merged PR ${MERGE_POINTS}, or ${REVIEWED_MERGE_POINTS} when someone else merged it or you contributed from outside, a push to your default branch ${PUSH_POINTS}, plus ${STREAK_POINTS_PER_DAY} points per streak day. each day up to ${DAILY_CAPS.RELEASE} releases, ${DAILY_CAPS.MERGE} merged PRs and ${DAILY_CAPS.PUSH} push count.`;

/** Sent from welcome@ when someone joins the recap from the footer form. */
export function recapConfirmEmail(token: string): Email {
  const confirmUrl = `${SITE_URL}/recap?confirm=${encodeURIComponent(token)}`;
  return {
    subject: "confirm your weekly ship recap",
    html: layout(
      `<p style="margin:0 0 14px">welcome to the weekly ship recap: once a week, who shipped, the fresh releases, and the longest streaks on outship.</p>
<p style="margin:0 0 22px">confirm it's you and the first one lands next monday.</p>
<p style="margin:0 0 22px">${button(confirmUrl, "confirm my email")}</p>
<p style="margin:0;color:${MUTED};font-size:13px">didn't sign up? ignore this email and you won't hear from us again.</p>`,
      STANDARD_FOOTER,
    ),
    text: `welcome to the weekly ship recap: once a week, who shipped, the fresh releases, and the longest streaks on outship.

confirm it's you and the first one lands next monday:
${confirmUrl}

didn't sign up? ignore this email and you won't hear from us again.`,
  };
}

/** Sent from welcome@ the first time a builder signs in with GitHub. */
export function builderWelcomeEmail({
  login,
  appInstalled,
}: {
  login: string;
  appInstalled: boolean;
}): Email {
  const handle = escapeHtml(login);
  const next = appInstalled
    ? {
        line: "the github app is already watching your repos, so your next ship shows up on its own.",
        href: `${SITE_URL}/profile`,
        label: "see your profile",
      }
    : {
        line: "one step left: install the outship github app on the repos you want tracked. you choose which ones.",
        href: GITHUB_APP_INSTALL_URL,
        label: "install the github app",
      };
  return {
    subject: `welcome to outship, @${login}`,
    html: layout(
      `<p style="margin:0 0 14px">you're in, @${handle}.</p>
<p style="margin:0 0 14px">outship turns what you actually ship on github into a public record: a profile at outship.dev/@${handle}, a streak, and a place on the leaderboard. ships can be attested onchain on base, so the receipts are yours.</p>
<p style="margin:0 0 14px;color:${MUTED};font-size:14px">${escapeHtml(POINTS_LINE)}</p>
<p style="margin:0 0 22px">${escapeHtml(next.line)}</p>
<p style="margin:0 0 22px">${button(next.href, next.label)}</p>
<p style="margin:0;color:${MUTED};font-size:13px">want the weekly ship recap? switch it on from your profile.</p>`,
      STANDARD_FOOTER,
    ),
    text: `you're in, @${login}.

outship turns what you actually ship on github into a public record: a profile at outship.dev/@${login}, a streak, and a place on the leaderboard. ships can be attested onchain on base, so the receipts are yours.

${POINTS_LINE}

${next.line}
${next.href}

want the weekly ship recap? switch it on from your profile: ${SITE_URL}/profile`,
  };
}

export type RecapData = {
  weekLabel: string;
  totalShips: number;
  activeBuilders: number;
  top: { login: string; points: number; ships: number }[];
  releases: { login: string; repo: string; tag: string }[];
  streaks: { login: string; streak: number }[];
};

/** Sent from recap@ every Monday to confirmed subscribers. */
export function weeklyRecapEmail(data: RecapData, token: string): Email {
  const unsubscribeUrl = `${SITE_URL}/recap?unsubscribe=${encodeURIComponent(token)}`;
  const profile = (login: string) =>
    `<a href="${SITE_URL}/@${encodeURIComponent(login)}" style="color:${BLUE};text-decoration:none">@${escapeHtml(login)}</a>`;
  const list = (items: string[]) =>
    `<ol style="margin:0 0 20px;padding-left:20px">${items.map((item) => `<li style="margin:0 0 6px">${item}</li>`).join("")}</ol>`;
  const heading = (text: string) =>
    `<p style="margin:0 0 8px;font-weight:600">${escapeHtml(text)}</p>`;

  const sections: string[] = [
    `<p style="margin:0 0 20px">${data.totalShips} ship${data.totalShips === 1 ? "" : "s"} from ${data.activeBuilders} builder${data.activeBuilders === 1 ? "" : "s"} this week.</p>`,
  ];
  const textSections: string[] = [
    `${data.totalShips} ship${data.totalShips === 1 ? "" : "s"} from ${data.activeBuilders} builder${data.activeBuilders === 1 ? "" : "s"} this week.`,
  ];

  if (data.top.length > 0) {
    sections.push(
      heading("most shipped") +
        list(data.top.map((b) => `${profile(b.login)} · ${b.points} pts from ${b.ships} ship${b.ships === 1 ? "" : "s"}`)),
    );
    textSections.push(
      `most shipped\n${data.top.map((b, i) => `${i + 1}. @${b.login} · ${b.points} pts from ${b.ships} ship${b.ships === 1 ? "" : "s"}`).join("\n")}`,
    );
  }
  if (data.releases.length > 0) {
    sections.push(
      heading("fresh releases") +
        list(data.releases.map((r) => `${escapeHtml(r.repo)} ${escapeHtml(r.tag)} by ${profile(r.login)}`)),
    );
    textSections.push(
      `fresh releases\n${data.releases.map((r) => `- ${r.repo} ${r.tag} by @${r.login}`).join("\n")}`,
    );
  }
  if (data.streaks.length > 0) {
    sections.push(
      heading("longest streaks") +
        list(data.streaks.map((s) => `${profile(s.login)} · ${s.streak} day${s.streak === 1 ? "" : "s"}`)),
    );
    textSections.push(
      `longest streaks\n${data.streaks.map((s, i) => `${i + 1}. @${s.login} · ${s.streak} day${s.streak === 1 ? "" : "s"}`).join("\n")}`,
    );
  }

  sections.push(`<p style="margin:0">${button(`${SITE_URL}/leaderboard`, "see the leaderboard")}</p>`);

  return {
    subject: `this week on outship: ${data.totalShips} ship${data.totalShips === 1 ? "" : "s"}`,
    html: layout(
      sections.join(""),
      `you're getting this because you confirmed the weekly ship recap. <a href="${escapeHtml(unsubscribeUrl)}" style="color:${MUTED}">unsubscribe</a> · ${STANDARD_FOOTER}`,
    ),
    text: `${textSections.join("\n\n")}

see the leaderboard: ${SITE_URL}/leaderboard

unsubscribe: ${unsubscribeUrl}`,
  };
}

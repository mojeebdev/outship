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

/** The one-time thank-you sent with the Founding Builder Shipmark. */
export function foundingBuilderEmail(): Email {
  const copy = `Hey Builder,

Before Outship becomes everything we're working towards, we want to take a moment to appreciate the people who believed in us from the beginning.

You joined us during our first public launch week.

That means something to us.

We're building Outship for people who believe in creating, experimenting, shipping and putting their ideas into the world.

We know that building isn't always easy. Sometimes you ship without seeing the results immediately. Sometimes the progress is slow. But every contribution matters.

As a small token of our appreciation, we've introduced Shipmarks, a new achievement system that celebrates your journey, consistency and milestones on Outship.

We've also created your Founding Builder badge.

You'll always have a place in the story of how Outship started.

Thank you for believing in what we're building.

Here's to everything you'll ship next.

With appreciation,

Mojeeb and the Outship Team

Founder, Outship
A BlindspotLab product

Keep shipping. ⚓`;
  const paragraphs = copy.split("\n\n").map((paragraph) =>
    `<p style="margin:0 0 14px">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
  ).join("");
  return {
    subject: "your Founding Builder Shipmark is here",
    html: layout(paragraphs, STANDARD_FOOTER),
    text: copy,
  };
}

/**
 * Sent once from reminder@, about 30 minutes after a builder signs in, when
 * the GitHub App still isn't installed: without it nothing they ship counts.
 */
export function installReminderEmail({ login }: { login: string }): Email {
  const handle = escapeHtml(login);
  return {
    subject: "one step left: connect your repos to outship",
    html: layout(
      `<p style="margin:0 0 14px">hey @${handle}, you signed in to outship, but the github app isn't installed yet, so nothing you ship is counted.</p>
<p style="margin:0 0 14px">it takes a minute: pick the repos you want tracked. your last 12 months of releases, merged PRs and commits come in straight away, and from then on every push to your default branch, merged PR and published release becomes a ship on your profile, your streak and the leaderboard. private repos count too, and stay hidden on your public page.</p>
<p style="margin:0 0 22px">${button(GITHUB_APP_INSTALL_URL, "install the github app")}</p>
<p style="margin:0;color:${MUTED};font-size:13px">this is the only reminder you'll get. already installed it? you're all set: see your profile at outship.dev/profile.</p>`,
      STANDARD_FOOTER,
    ),
    text: `hey @${login}, you signed in to outship, but the github app isn't installed yet, so nothing you ship is counted.

it takes a minute: pick the repos you want tracked. your last 12 months of releases, merged PRs and commits come in straight away, and from then on every push to your default branch, merged PR and published release becomes a ship on your profile, your streak and the leaderboard. private repos count too, and stay hidden on your public page.

install the github app:
${GITHUB_APP_INSTALL_URL}

this is the only reminder you'll get. already installed it? you're all set: ${SITE_URL}/profile`,
  };
}

export type HistoryReady = {
  login: string;
  name: string | null;
  score: number;
  imported: number;
  /** Joined while the import was switched off: say sorry for the wait. */
  apology: boolean;
  /** A ready-made "share on X" link for their profile. */
  shareHref: string;
};

/**
 * Sent once from Mojeeb, when a builder's last 12 months have been imported:
 * their points, how many past ships came in, and a nudge to share and invite.
 */
export function historyReadyEmail(data: HistoryReady): Email {
  const first = data.name?.trim().split(/\s+/)[0] || `@${data.login}`;
  const points = data.score.toLocaleString("en-US");
  const ships = `${data.imported.toLocaleString("en-US")} ship${data.imported === 1 ? "" : "s"}`;
  const profile = `${SITE_URL}/@${data.login}`;
  const invite = `${SITE_URL}/profile/community`;
  const opening = data.apology
    ? "i owe you an apology. while cleaning up some code, i accidentally switched off the part of outship that imports your last 12 months of github work, so your all-time points showed 0 when you joined. that's on me, and i'm sorry. it's fixed now, and your history is in."
    : "outship just finished importing your last 12 months of github work. your history is in.";
  return {
    subject: "your last 12 months are on outship",
    html: layout(
      `<p style="margin:0 0 14px">hey ${escapeHtml(first)},</p>
<p style="margin:0 0 18px">${escapeHtml(opening)}</p>
<p style="margin:0 0 4px;font-size:28px;font-weight:600;color:${VOID}">${escapeHtml(points)} points</p>
<p style="margin:0 0 22px;color:${MUTED}">${escapeHtml(ships)} from the last 12 months</p>
<p style="margin:0 0 22px">${button(profile, "see your profile")}</p>
<p style="margin:0 0 14px">proud of it? <a href="${escapeHtml(data.shareHref)}" style="color:${BLUE}">share it on X</a>, and <a href="${escapeHtml(invite)}" style="color:${BLUE}">invite the builders you know</a>. every one who joins makes the board more fun to climb.</p>
<p style="margin:0 0 4px">thanks for being one of the first. it means a lot.</p>
<p style="margin:14px 0 0">Mojeeb<br><span style="color:${MUTED}">founder, outship<br>BlindspotLab</span></p>`,
      STANDARD_FOOTER,
    ),
    text: `hey ${first},

${opening}

${points} points
${ships} from the last 12 months

see your profile: ${profile}

proud of it? share it on X: ${data.shareHref}
and invite the builders you know: ${invite}
every one who joins makes the board more fun to climb.

thanks for being one of the first. it means a lot.

Mojeeb
founder, outship
BlindspotLab`,
  };
}

/**
 * A builder's invite to a friend, from invite@ as "{inviter} via outship".
 * Fixed wording: the inviter can't add text. Every one carries a link that
 * stops all outship email to the address.
 */
export function inviteEmail({ inviterLogin, inviterDisplay, token }: { inviterLogin: string; inviterDisplay: string; token: string }): Email {
  const join = `${SITE_URL}/api/auth/github/login?ref=${encodeURIComponent(inviterLogin)}`;
  const profile = `${SITE_URL}/@${inviterLogin}`;
  const optOut = `${SITE_URL}/invite/opt-out?token=${encodeURIComponent(token)}`;
  const who = escapeHtml(inviterDisplay);
  const handle = escapeHtml(inviterLogin);
  return {
    subject: `${inviterDisplay} invited you to outship`,
    html: layout(
      `<p style="margin:0 0 14px">${who} (<a href="${escapeHtml(profile)}" style="color:${BLUE}">@${handle}</a>) thinks you should be on outship.</p>
<p style="margin:0 0 14px">outship turns what you actually ship into proof: pushes, merged PRs and releases, verified by github, scored and ranked, with receipts you can put onchain on base. your last 12 months count from day one.</p>
<p style="margin:0 0 22px">${button(join, "join with github")}</p>
<p style="margin:0;color:${MUTED};font-size:13px">ideas are free. shipping isn't.</p>`,
      `you got this because @${handle} invited you; outship won't send you another invite. <a href="${escapeHtml(optOut)}" style="color:${MUTED}">never email me again</a>.`,
    ),
    text: `${inviterDisplay} (@${inviterLogin}) thinks you should be on outship.

outship turns what you actually ship into proof: pushes, merged PRs and releases, verified by github, scored and ranked, with receipts you can put onchain on base. your last 12 months count from day one.

join with github: ${join}
their profile: ${profile}

ideas are free. shipping isn't.

you got this because @${inviterLogin} invited you; outship won't send you another invite.
never email me again: ${optOut}`,
  };
}

/**
 * Sent once from Mojeeb, about 30 minutes after a builder uninstalls the
 * GitHub App: what went wrong, a reply invite, and the way back.
 */
export function uninstallNoteEmail({ login, name }: { login: string; name: string | null }): Email {
  const first = name?.trim().split(/\s+/)[0] || `@${login}`;
  return {
    subject: "was something off with outship?",
    html: layout(
      `<p style="margin:0 0 14px">hey ${escapeHtml(first)},</p>
<p style="margin:0 0 14px">i saw you removed the outship app from github. no hard feelings. i'd just love to know why: was something confusing, or not working the way you expected? hit reply and tell me. i read every one.</p>
<p style="margin:0 0 22px">if you'd like to give it another go, it takes a minute, and your last 12 months of releases, merged PRs and commits come in as soon as you install.</p>
<p style="margin:0 0 22px">${button(GITHUB_APP_INSTALL_URL, "install the github app")}</p>
<p style="margin:14px 0 0">Mojeeb<br><span style="color:${MUTED}">founder, outship<br>BlindspotLab</span></p>`,
      STANDARD_FOOTER,
    ),
    text: `hey ${first},

i saw you removed the outship app from github. no hard feelings. i'd just love to know why: was something confusing, or not working the way you expected? hit reply and tell me. i read every one.

if you'd like to give it another go, it takes a minute, and your last 12 months of releases, merged PRs and commits come in as soon as you install:
${GITHUB_APP_INSTALL_URL}

Mojeeb
founder, outship
BlindspotLab`,
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

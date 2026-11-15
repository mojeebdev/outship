// "share on X" from outship. Every share quotes the launch article, so each
// builder who posts their profile also carries the story of why outship
// exists: X shows a post link passed as `url` as a quoted post under the text.
import { SITE_URL } from "@/lib/structured-data";

/** The launch article on X, quoted by every share. */
export const LAUNCH_POST_URL = "https://x.com/MojeebMotion/status/2122074804815597728";

/** A link that opens X's composer with the text, quoting the launch post. */
export function shareOnXHref(text: string, quote: string = LAUNCH_POST_URL): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(quote)}`;
}

export type ProfileShare = {
  login: string;
  tier: string;
  score: number;
  weekRank: number | null;
  streak: number;
};

/** What a builder posts about their own profile, in outship's voice. */
export function profileShareText({ login, tier, score, weekRank, streak }: ProfileShare): string {
  const facts = [`${score.toLocaleString("en-US")} points`];
  if (weekRank) facts.push(`#${weekRank} this week`);
  // A one-day streak reads as nothing to share; two days on is a streak.
  if (streak > 1) facts.push(`${streak}-day streak`);
  // "an admiral", "a captain": the tier names start with either.
  const article = /^[aeiou]/.test(tier) ? "an" : "a";
  return [
    `i'm ${article} ${tier} on outship: ${facts.join(" · ")}.`,
    "every ship verified by github, attested on base.",
    `${SITE_URL}/@${login}`,
  ].join("\n\n");
}

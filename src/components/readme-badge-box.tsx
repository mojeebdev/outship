import { CopyButton } from "@/components/copy-button";
import { SITE_URL } from "@/lib/structured-data";
import { BADGE_HEIGHT, BADGE_WIDTH } from "@/lib/badge";

/** The /profile box with ready-to-paste README badge snippets. */
export function ReadmeBadgeBox({ login, hidden }: { login: string; hidden: boolean }) {
  const profile = `${SITE_URL}/@${login}`;
  const badge = `${profile}/badge.svg`;
  const markdown = `[![${login} on outship](${badge})](${profile})`;
  const html = `<a href="${profile}"><img src="${badge}" alt="${login} on outship" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}"></a>`;
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-5">
      <div>
        <p className="font-medium">README badge</p>
        <p className="mt-1 text-sm text-text-muted-1">
          your score, streak and rank as a card for a github README, updated hourly.
          {hidden && " while your profile is hidden, it shows “not found”."}
        </p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- the live badge itself, an SVG from this site */}
      <img src={`/@${login}/badge.svg`} alt={`${login} on outship`} width={BADGE_WIDTH} height={BADGE_HEIGHT} className="max-w-full" />
      {[
        { label: "markdown", text: markdown },
        { label: "html", text: html },
      ].map(({ label, text }) => (
        <div key={label} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded bg-cream px-3 py-2 text-xs">{text}</code>
          <CopyButton text={text} label={`copy ${label}`} />
        </div>
      ))}
    </div>
  );
}

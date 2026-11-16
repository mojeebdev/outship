import { CopyButton } from "@/components/copy-button";
import { BADGE_HEIGHT, BADGE_WIDTH } from "@/lib/badge";
import { badgeAgentPrompt, badgeSnippets } from "@/lib/badge-snippets";

/** The /profile box with ready-to-paste README badge snippets. */
export function ReadmeBadgeBox({ login, hidden }: { login: string; hidden: boolean }) {
  const { markdown, html } = badgeSnippets(login);
  const prompt = badgeAgentPrompt(login);
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
      {/* For builders who'd rather not edit a README by hand: the button
          copies a prompt for a coding agent, which adds the badge line and
          nothing else. The prompt itself stays off the page to keep it short. */}
      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">or let your agent do it</p>
          <p className="text-xs text-text-muted-2">copy a prompt for claude, cursor, copilot or any coding agent.</p>
        </div>
        <CopyButton text={prompt} label="copy prompt" />
      </div>
    </div>
  );
}

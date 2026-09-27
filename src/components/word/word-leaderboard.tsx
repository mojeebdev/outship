import type { LeaderboardEntry } from "@/lib/word/leaderboard";

function formatRelativeTime(iso: string): string {
  const scannedAt = new Date(iso).getTime();
  if (!Number.isFinite(scannedAt)) return "";

  const minutes = Math.max(0, Math.round((Date.now() - scannedAt) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(scannedAt).toISOString().slice(0, 10);
}

/**
 * The homepage leaderboard.
 *
 * Every row is an opt-in listing of a site's homepage, counted by this server.
 */
export function WordLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="word-board">
        <p className="word-board-empty">
          No one has opted in yet. Count a homepage above and tick the box to be the first.
        </p>
      </div>
    );
  }

  return (
    <ol className="word-board">
      {entries.map((entry, index) => (
        <li className="word-board-row" key={entry.hostname}>
          <span className="word-board-rank">{index + 1}</span>
          <span className="word-board-host">
            <a href={entry.url} target="_blank" rel="noopener noreferrer nofollow">
              {entry.hostname}
            </a>
            <time className="word-board-time" dateTime={entry.lastScannedAt}>
              scanned {formatRelativeTime(entry.lastScannedAt)}
            </time>
          </span>
          <span className="word-board-count">
            {entry.wordCount.toLocaleString("en-US")} words
          </span>
        </li>
      ))}
    </ol>
  );
}

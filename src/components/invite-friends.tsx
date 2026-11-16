"use client";

import { useState, type FormEvent } from "react";

type Invite = { email: string; joined: boolean };

// The "invite friends" box on /profile: an email, a button, and who you've
// invited so far. The rules (how many, once per address) live on the server
// (src/lib/invites.ts); this only shows what it says.
export function InviteFriends({
  initial,
  remaining: initialRemaining,
  limit,
}: {
  initial: Invite[];
  remaining: number;
  limit: number;
}) {
  const [invites, setInvites] = useState(initial);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await response.json().catch(() => ({}))) as { ok?: boolean; email?: string; remaining?: number; error?: string };
      if (response.ok && json.ok && json.email) {
        setInvites([{ email: json.email, joined: false }, ...invites]);
        setRemaining(json.remaining ?? remaining - 1);
        setEmail("");
        setMessage({ ok: true, text: `invite sent to ${json.email}.` });
      } else {
        setMessage({ ok: false, text: json.error ?? "couldn't send that invite. try again in a bit." });
      }
    } catch {
      setMessage({ ok: false, text: "couldn't reach outship. check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-5">
      <div>
        <p className="font-medium">invite friends</p>
        <p className="mt-1 text-sm text-text-muted-1">
          know builders who ship? we&apos;ll email them one invite from you, with your profile. their last 12 months count from day one.
        </p>
      </div>
      {remaining > 0 ? (
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="invite-email" className="sr-only">
            their email
          </label>
          <input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="friend@example.com"
            className="min-w-0 flex-1 rounded-md border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-base-blue"
          />
          <button
            type="submit"
            disabled={busy}
            className="shrink-0 rounded-md border border-base-blue bg-base-blue px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "sending…" : "send invite"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-text-muted-1">you&apos;ve sent all your invites. thank you for bringing builders in.</p>
      )}
      {message && (
        <p role="status" className={`text-sm ${message.ok ? "text-base-blue" : "text-[#c2410c]"}`}>
          {message.text}
        </p>
      )}
      <p className="text-xs text-text-muted-2">
        {remaining} of {limit} invites left · one invite per address, ever, and they can opt out of all outship email.
      </p>
      {invites.length > 0 && (
        <ul className="flex flex-col divide-y divide-border border-t border-border text-sm">
          {invites.map((invite) => (
            <li key={invite.email} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate">{invite.email}</span>
              <span className={`shrink-0 text-xs ${invite.joined ? "font-medium text-base-blue" : "text-text-muted-2"}`}>
                {invite.joined ? "joined" : "invited"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

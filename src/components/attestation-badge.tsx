import Link from "next/link";
import { IconSeal } from "@/components/icons";
import { easscanUrl } from "@/lib/web3/eas";

// Shown on hover over a v1 badge. Kept short; the FAQ has the longer version.
const LEGACY_EXPLANATION =
  "attested with outship's first schema, which had no resolver: anyone could write to it, so outship can't vouch that this one matches a real ship. new attestations are signed by outship and checked onchain.";

export function AttestationBadge({
  chain,
  easUid,
  schemaVersion,
}: {
  chain: string;
  easUid: string;
  schemaVersion: number;
}) {
  const legacy = schemaVersion < 2;
  return (
    <Link
      href={easscanUrl(chain, easUid)}
      target="_blank"
      rel="noopener noreferrer"
      title={legacy ? LEGACY_EXPLANATION : "signed by outship and verified on base"}
      className={`flex shrink-0 items-center gap-1.5 text-xs font-medium transition hover:opacity-80 ${
        legacy ? "text-text-muted-2" : "text-base-blue"
      }`}
    >
      <IconSeal className="h-3.5 w-3.5" aria-hidden="true" />
      {legacy ? "legacy · unverified" : "attested onchain"}
      {legacy && <span className="sr-only">: {LEGACY_EXPLANATION}</span>}
    </Link>
  );
}

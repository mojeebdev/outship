import Link from "next/link";
import { IconSeal } from "@/components/icons";
import { easscanUrl } from "@/lib/web3/eas";

export function AttestationBadge({ chain, easUid }: { chain: string; easUid: string }) {
  return (
    <Link
      href={easscanUrl(chain, easUid)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-base-blue transition hover:opacity-80"
    >
      <IconSeal className="h-3.5 w-3.5" />
      attested onchain
    </Link>
  );
}

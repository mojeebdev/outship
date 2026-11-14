import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { IconGithub, IconX } from "@/components/icons";

export const metadata: Metadata = {
  title: "contact — outship",
};

const emails = [
  {
    address: "support@mail.outship.dev",
    use: "help with your account, your ships, or a data or removal request.",
  },
  {
    address: "mojeeb@mail.outship.dev",
    use: "partnerships, press, or anything you'd rather send to me directly.",
  },
];

export default function ContactPage() {
  return (
    <SiteShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-20">
        <h1 className="text-3xl font-medium sm:text-4xl">contact</h1>
        <p className="text-text-muted-1">
          a real person reads everything sent here.
        </p>

        <ul className="flex flex-col gap-3">
          {emails.map(({ address, use }) => (
            <li
              key={address}
              className="flex flex-col gap-1 rounded-lg border border-border bg-white p-4"
            >
              <a href={`mailto:${address}`} className="font-medium text-base-blue hover:underline">
                {address}
              </a>
              <span className="text-sm text-text-muted-1">{use}</span>
            </li>
          ))}
        </ul>

        <p className="text-sm text-text-muted-1">or find outship on</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href="https://github.com/mojeebdev/outship"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-cream"
          >
            <IconGithub className="h-4 w-4" />
            github
          </a>
          <a
            href="https://x.com/outshipdev"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-cream"
          >
            <IconX className="h-4 w-4" />
            x
          </a>
        </div>
      </div>
    </SiteShell>
  );
}

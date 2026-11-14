// Worker entry point. OpenNext's generated worker serves the site; this
// wrapper adds the cron jobs declared in wrangler.jsonc and the MTA-STS policy.
//
// Plain JS on purpose: .open-next/worker.js only exists after
// `opennextjs-cloudflare build`, which runs after `next build` type-checks,
// so a .ts entry here fails that check. The logic lives in the type-checked
// src/lib/expire-streaks.ts; this file only wires it up.
import nextHandler from "./.open-next/worker.js";
import { expireStaleStreaks } from "./src/lib/expire-streaks";
import { sendWeeklyRecap } from "./src/lib/email/weekly-recap";

// Must match the crons in wrangler.jsonc.
const DAILY_STREAKS = "5 0 * * *";
const WEEKLY_RECAP = "0 9-11 * * 1";

// MTA-STS (RFC 8461) for mail.outship.dev, whose mail is hosted by Zoho.
// Sending servers fetch this over HTTPS and then refuse to deliver to any MX
// not listed here, or over a connection without valid TLS. The mx lines must
// match mail.outship.dev's MX records. Whenever this text changes, also change
// the id in the _mta-sts.mail TXT record so senders re-fetch it.
const MTA_STS_HOST = "mta-sts.mail.outship.dev";
const MTA_STS_POLICY = [
  "version: STSv1",
  "mode: enforce",
  "mx: mx.zoho.com",
  "mx: mx2.zoho.com",
  "mx: mx3.zoho.com",
  "max_age: 604800",
  "",
].join("\r\n");

function mtaStsResponse(request) {
  const { pathname } = new URL(request.url);
  if (pathname !== "/.well-known/mta-sts.txt") {
    return new Response("not found", { status: 404 });
  }
  return new Response(MTA_STS_POLICY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

const worker = {
  fetch(request, env, ctx) {
    if (new URL(request.url).hostname === MTA_STS_HOST) {
      return mtaStsResponse(request);
    }
    return nextHandler.fetch(request, env, ctx);
  },

  async scheduled(controller, env) {
    if (controller.cron === DAILY_STREAKS) {
      const reset = await expireStaleStreaks(env.DB);
      console.log(`expire-streaks: reset ${reset} builder(s)`);
    } else if (controller.cron === WEEKLY_RECAP) {
      const result = await sendWeeklyRecap(env.DB, env.EMAIL);
      console.log("weekly-recap:", JSON.stringify(result));
    } else {
      console.warn(`scheduled: no job for cron "${controller.cron}"`);
    }
  },
};

export default worker;

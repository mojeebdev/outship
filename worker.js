// Worker entry point. OpenNext's generated worker serves the site; this
// wrapper adds the cron jobs declared in wrangler.jsonc, the MTA-STS policy
// and the www redirect.
//
// Plain JS on purpose: .open-next/worker.js only exists after
// `opennextjs-cloudflare build`, which runs after `next build` type-checks,
// so a .ts entry here fails that check. The logic lives in the type-checked
// src/lib/expire-streaks.ts; this file only wires it up.
import nextHandler from "./.open-next/worker.js";
import { expireStaleStreaks } from "./src/lib/expire-streaks";
import { sendWeeklyRecap } from "./src/lib/email/weekly-recap";
import { sendInstallReminders } from "./src/lib/email/install-reminder";
import { sendHistoryReadyEmails } from "./src/lib/email/history-ready";
import { adminLogins } from "./src/lib/admin-logins";
import { CRON_HEADER, cronToken } from "./src/lib/cron-auth";

// Must match the crons in wrangler.jsonc.
const DAILY_STREAKS = "5 0 * * *";
const WEEKLY_RECAP = "0 9-11 * * 1";
// Every 10 minutes, so the install reminder lands 30 to 40 minutes after sign-in.
const INSTALL_REMINDER = "*/10 * * * *";
const BACKFILL = "*/2 * * * *";

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

// www.outship.dev is only an alias: send it to the apex, keeping the path
// and query, with a permanent redirect.
const WWW_HOST = "www.outship.dev";
const APEX_ORIGIN = "https://outship.dev";

const worker = {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname === WWW_HOST) {
      return Response.redirect(`${APEX_ORIGIN}${url.pathname}${url.search}`, 301);
    }
    if (url.hostname === MTA_STS_HOST) {
      return mtaStsResponse(request);
    }
    return nextHandler.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (controller.cron === BACKFILL) {
      // Runs through the Next route so it shares the app's database client
      // and helpers. An in-process call: the request never leaves the Worker.
      const response = await nextHandler.fetch(
        new Request("https://outship.dev/api/internal/backfill", {
          method: "POST",
          headers: { [CRON_HEADER]: await cronToken(env.SESSION_SECRET) },
        }),
        env,
        ctx,
      );
      console.log(`backfill: ${response.status} ${await response.text()}`);
    } else if (controller.cron === DAILY_STREAKS) {
      const reset = await expireStaleStreaks(env.DB);
      console.log(`expire-streaks: reset ${reset} builder(s)`);
    } else if (controller.cron === WEEKLY_RECAP) {
      const result = await sendWeeklyRecap(env.DB, env.EMAIL);
      console.log("weekly-recap:", JSON.stringify(result));
    } else if (controller.cron === INSTALL_REMINDER) {
      const result = await sendInstallReminders(env.DB, env.EMAIL);
      if (result.sent || result.failed || result.stoppedOn) {
        console.log("install-reminder:", JSON.stringify(result));
      }
      // Once a builder's 12-month import is done: one email from Mojeeb.
      // Admins (outship's own account) are skipped.
      const history = await sendHistoryReadyEmails(env.DB, env.EMAIL, {
        skipLogins: adminLogins(env.ADMIN_GITHUB_LOGINS),
      });
      if (history.sent || history.failed || history.stoppedOn) {
        console.log("history-ready:", JSON.stringify(history));
      }
    } else {
      console.warn(`scheduled: no job for cron "${controller.cron}"`);
    }
  },
};

export default worker;

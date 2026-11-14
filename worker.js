// Worker entry point. OpenNext's generated worker still serves every request;
// this wrapper only adds the cron jobs declared in wrangler.jsonc.
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

const worker = {
  fetch: nextHandler.fetch,

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

// Worker entry point. OpenNext's generated worker still serves every request;
// this wrapper only adds the daily cron job declared in wrangler.jsonc.
//
// Plain JS on purpose: .open-next/worker.js only exists after
// `opennextjs-cloudflare build`, which runs after `next build` type-checks,
// so a .ts entry here fails that check. The logic lives in the type-checked
// src/lib/expire-streaks.ts; this file only wires it up.
import nextHandler from "./.open-next/worker.js";
import { expireStaleStreaks } from "./src/lib/expire-streaks";

const worker = {
  fetch: nextHandler.fetch,

  async scheduled(_controller, env) {
    const reset = await expireStaleStreaks(env.DB);
    console.log(`expire-streaks: reset ${reset} builder(s)`);
  },
};

export default worker;

// Adds a testimonial to the home page:
//
//   npm run testimonial -- @handle "what they said" [link to their post]
//
// Looks the person up once (display name and profile picture, through the
// free fxtwitter mirror, so no X API key), saves a copy of the picture under
// public/testimonials, and adds the entry to src/lib/testimonials.json. The
// site itself never calls X or the mirror, so visitors aren't tracked and
// nothing breaks if either goes away. Re-run for the same handle to update
// their name and picture. Commit the JSON and the picture.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const JSON_FILE = new URL("src/lib/testimonials.json", root);
const PICTURES = new URL("public/testimonials/", root);

const [rawHandle, quote, post] = process.argv.slice(2);
const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

if (!rawHandle || !quote) fail('usage: npm run testimonial -- @handle "what they said" [post link]');
const handle = rawHandle.trim().replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0];
if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) fail(`"${rawHandle}" isn't an X handle`);
if (quote.length > 280) fail(`the quote is ${quote.length} characters; keep it to 280`);
if (post && !/^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]+\/status\/\d+/.test(post)) {
  fail("the post link should look like https://x.com/handle/status/123…");
}

// The mirror is flaky (it sometimes says "not found" for a real account), so ask a few times.
async function lookup() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(`https://api.fxtwitter.com/${handle}`, { signal: AbortSignal.timeout(15_000) });
      const user = (await res.json()).user;
      if (user?.name && user?.avatar_url) return user;
    } catch {
      /* try again */
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
  }
  return null;
}

const user = await lookup();
if (!user) fail(`couldn't find @${handle} (is it spelled right? the lookup service can also be down: try again in a minute)`);

const image = await fetch(user.avatar_url.replace(/_(normal|bigger|200x200)\./, "_400x400."), {
  signal: AbortSignal.timeout(20_000),
});
if (!image.ok) fail(`couldn't download their picture (${image.status})`);
const type = image.headers.get("content-type") ?? "";
const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[type];
if (!ext) fail(`unexpected picture type "${type}"`);
await mkdir(PICTURES, { recursive: true });
const file = `${handle.toLowerCase()}.${ext}`;
await writeFile(new URL(file, PICTURES), Buffer.from(await image.arrayBuffer()));

const all = JSON.parse(await readFile(JSON_FILE, "utf8"));
const entry = { handle: user.screen_name ?? handle, name: user.name, avatar: `/testimonials/${file}`, quote: quote.trim(), ...(post ? { url: post } : {}) };
const at = all.findIndex((t) => t.handle.toLowerCase() === handle.toLowerCase() && t.quote === entry.quote);
if (at === -1) all.push(entry);
else all[at] = entry;
await writeFile(JSON_FILE, JSON.stringify(all, null, 2) + "\n");

console.log(`✓ ${at === -1 ? "added" : "updated"} ${user.name} (@${entry.handle})`);
console.log(`  picture: public/testimonials/${file}`);
console.log(`  ${all.length} testimonial(s) in ${fileURLToPath(JSON_FILE).replace(fileURLToPath(root), "")}`);

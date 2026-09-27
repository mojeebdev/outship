# Word (word.outship.dev)

Word is a second product served from this same Next.js app: you give it a web
address, it counts the words on that page.

- **Production:** https://word.outship.dev
- **Local development:** http://localhost:3000/word
- **Pages:** `src/app/word/**`
- **API:** `src/app/api/word/**`
- **Library:** `src/lib/word/**`
- **Hostname routing:** `src/proxy.ts`

Word has its own minimal layout (`src/app/word/layout.tsx`) and its own scoped
stylesheet (`src/app/word/word.css`). It deliberately does **not** use
`SiteShell`, so outship's marketing navigation and footer never appear on the
Word hostname, and outship.dev is unchanged.

---

## Routing

**https://word.outship.dev is Word's canonical home.** `src/proxy.ts` is a
Next.js 16 Proxy (the renamed `middleware`) and runs on page requests only:

```
matcher: ["/((?!api/|_next/|_vercel/|.*\\.[^/]+$).*)"]
```

so API routes, framework internals and anything with a file extension are never
rewritten or redirected, and resolve identically on every hostname.

The rules themselves live in `src/lib/word/routing.ts` as a pure function,
`decideRoute(host, pathname, search)`, so they can be tested directly rather
than through a request object. `proxy.ts` only turns a decision into a
response. Three hostnames matter:

**word.outship.dev** — serves Word from the root.

| Request | Internally serves | Public URL |
| --- | --- | --- |
| `/` | `/word` | unchanged |
| `/anything?q=1` | `/word/anything?q=1` | unchanged |
| `/word` or `/word/…` | — | 308 to `/…` |

**outship.dev** (and `www.`) — the main site, where Word is not canonical.

| Request | Result |
| --- | --- |
| `/word` | 308 to `https://word.outship.dev/` |
| `/word/result/{id}?utm_source=x` | 308 to `https://word.outship.dev/result/{id}?utm_source=x` |
| `/word/…` (any Word page, now or later) | 308 to the same path on the subdomain |
| `/wordpress`, `/words`, `/wordle`, `/sword` | untouched |
| every other outship route | untouched |

**Everything else** — localhost, preview deployments — falls through
unchanged, which is what keeps `/word` usable in local development and on a
preview URL without a subdomain.

Extra hostnames can be added at runtime without a code change: `WORD_HOSTS`
for hosts that should serve Word at the root, `MAIN_HOSTS` for hosts that
should redirect `/word` away.

Notes:

- The rewrite happens **once** per request — Proxy runs before filesystem
  routing and does not re-enter — so there are no rewrite loops.
- `/word` on the Word hostname is redirected rather than rewritten, so a page
  never has two public URLs and a doubled `/word/word` prefix can't be produced.
- Query strings survive because the rewrite uses `request.nextUrl.clone()`.
- Unknown paths render Word's own 404: `src/app/word/[...slug]/page.tsx` calls
  `notFound()`, which `src/app/word/not-found.tsx` renders. Without the
  catch-all, an unmatched path would fall through to the app's root 404 and show
  outship's.
- Internal links go through `getWordBasePath()` / `wordHref()`
  (`src/lib/word/paths.ts`), which resolve to `""` on the Word hostname and
  `"/word"` everywhere else. The same host header drives both, so server and
  client markup agree.
- Only `/word` and `/word/...` redirect, never `/wordpress` and friends: the
  test is an exact match or a following slash, not `startsWith("/word")`.
- Redirects cannot chain into a loop. The main host sends `/word*` to the
  subdomain, and the subdomain *rewrites* rather than redirecting, so the
  destination is terminal. A request for `/word/` takes two hops — Next
  normalises the trailing slash to `/word` before the proxy sees it, then the
  proxy redirects — which is correct, just not a single hop.
- Every public URL Word emits is absolute against `WORD_CANONICAL_ORIGIN`:
  `alternates.canonical`, `og:url`, `og:image`, `twitter:image`, the share
  link and the download link. There is no sitemap or `robots.txt` in this
  project, so there are no entries to point anywhere.

Extra hostnames (a preview deployment, for instance) can be added at runtime
with a comma-separated `WORD_HOSTS` variable — no code change needed.

---

## Counting rules

Word fetches the page server-side and counts the text in the HTML that comes
back. Parsing uses [htmlparser2](https://github.com/fb55/htmlparser2), a real
streaming HTML parser that behaves identically on Node (local development) and
on the Cloudflare Workers runtime (production), so fixtures and production agree.

**Counted**

- Readable text anywhere in the document body, including navigation and footer
  text.
- Text inside inline elements, joined without an artificial boundary: `<b>on</b>e`
  counts as one word, exactly as a browser renders it.
- HTML entities, decoded first (`&amp;` → `&`, `&nbsp;` → a space).

**Not counted**

- `script`, `style`, `noscript`, `template`, `svg`, `canvas`, `audio`, `video`,
  `iframe`, `object`, `embed` subtrees.
- The document `head` — `title`, `meta`, `link`, `base`.
- `select`, `option`, `datalist` (dropdown contents aren't visible page copy).
- Markup itself, HTML comments, and attribute values (including `alt` text).
- Elements that are explicitly hidden: a `hidden` attribute,
  `aria-hidden="true"`, or an inline `display: none`, `visibility: hidden` or
  `content-visibility: hidden`.

**How the numbers are produced**

1. Text is collected in document order. Every non-inline element boundary
   contributes a space, so `<p>a</p><p>b</p>` is `a b`, not `ab`.
2. Whitespace is normalised: every run of Unicode whitespace (including the
   non-breaking space `&nbsp;` decodes to) collapses to one space, then the
   result is trimmed.
3. **Words** are counted with one expression, shared by the page count and the
   historical benchmark so the two numbers on the result screen are always
   produced by the same rule:

   ```js
   text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0
   ```

   A word is a run of letters and/or numbers that may carry internal
   apostrophes or hyphens: `don't` and `state-of-the-art` count once each,
   `1,521` counts as two (a comma is not an internal joiner), and punctuation,
   symbols and separators are not words. A language written without spaces
   counts as one token per unbroken run — for those pages the character count is
   the more useful number, and the UI says so. Changing this expression means
   bumping `COUNTING_RULE_VERSION` and re-verifying the benchmark.
4. **Characters** are Unicode code points of that same normalised text, spaces
   included. `a😀b` is 3 characters, not 4.

**Scope, stated plainly in the UI**

Word counts *one page*, not a whole site, and it counts the HTML the server
returns — it does not execute the page's JavaScript. Text a page loads into the
DOM afterwards is not included. Both facts are on the page itself, not just
here.

---

## Security: fetching user-supplied URLs

`src/lib/word/url.ts` and `src/lib/word/fetch-page.ts` hold the controls. Every
hop — the submitted URL and each redirect — goes through the full check.

| Control | Where |
| --- | --- |
| http/https only | `assertSafeUrlSyntax` |
| Ports 80, 443, 8080, 8443 only | `assertSafeUrlSyntax` |
| No embedded credentials (`user:pass@`) | `assertSafeUrlSyntax` |
| `localhost`, `*.local`, `*.internal`, `metadata.google.internal`, single-label names, and other reserved suffixes rejected | `assertSafeUrlSyntax` |
| Private / reserved / link-local IP literals rejected in **any** notation (`127.0.0.1`, `2130706433`, `0x7f000001`, `127.1`, `[::1]`, `[::ffff:10.0.0.1]`, NAT64, 6to4, Teredo) | `isBlockedIpv4` / `isBlockedIpv6` |
| Cloud metadata (169.254.0.0/16, including 169.254.169.254) rejected | `isBlockedIpv4` |
| Hostname resolved over DNS-over-HTTPS and **every** returned A/AAAA address classified before the request goes out | `assertResolvesToPublicAddress` |
| Each redirect `Location` re-validated from scratch | `fetchPageHtml` |
| Max 3 redirects | `FETCH_LIMITS.maxRedirects` |
| 6s per hop, 10s for the whole scan | `FETCH_LIMITS` |
| 2MB response cap, enforced on the stream as well as on `content-length` | `readCappedBody` |
| `text/html` / `application/xhtml+xml` only | `fetchPageHtml` |
| No cookies, no authorization, no client headers forwarded — outbound requests carry a fixed minimal header set | `fetchPageHtml` |
| Fetched HTML is never returned to the browser or rendered, only counted | `scanUrl` |

The URL parser normalises host notation for us: `new URL()` turns every legal
IPv4 spelling into a dotted quad and compresses IPv6, so the classifiers see one
canonical form rather than having to out-guess every encoding.

DNS resolution fails **closed**: if the resolver can't be reached, the scan is
refused rather than attempted. `WORD_DNS_RESOLVER` overrides the endpoint
(default `https://cloudflare-dns.com/dns-query`).

### Known limitation: DNS rebinding

**The Workers runtime has no IP-pinned fetch.** We resolve the hostname, check
every address, and then call `fetch()`, which resolves the name again. A DNS
rebinding attacker controlling a domain's authoritative nameserver with a
near-zero TTL could answer public on our lookup and private on the fetch. There
is no API in this runtime to connect to a validated IP while keeping the correct
`Host` header, so this window cannot be closed in application code. It is stated
here rather than glossed over.

What limits the impact today:

- Worker egress leaves Cloudflare's edge onto the public internet. RFC1918,
  loopback and link-local destinations are not routable from there, so the
  classic "rebind to 169.254.169.254 / 127.0.0.1 / 10.x" targets are not
  reachable even if validation were bypassed.
- Every redirect is validated independently, so redirect-based pivots are caught.
- Word never returns or renders the fetched HTML. A successful blind pivot leaks
  a word count, a character count and a duration — not page content.

If Word is ever run somewhere with private-network reachability (a self-hosted
Node deployment, a VPC, a Cloudflare Tunnel or Hyperdrive binding in the same
account), **re-evaluate this before shipping there**: that environment needs a
pinned-IP fetch or an egress proxy with an allowlist.

### Rate limiting and caching

- **Rate limit:** 10 scans per minute and 100 per hour per client IP
  (`cf-connecting-ip`), on both `/api/word/count` and the leaderboard opt-in.
  Counters live in the existing D1 database (`WordRateLimit`), bumped with a
  single atomic upsert per window so concurrent requests can't share a stale
  count, and swept opportunistically. It fails **open**: a database hiccup
  doesn't take the product down.
- **Cache:** successful scans are cached for 5 minutes in the Workers Cache API
  (`caches.default`), which needs no binding. Under `next dev` on Node there is
  no cache and scans simply always run.

### Privacy

- Submitted query strings are kept out of anything public. `shareableUrl()`
  strips the query string, fragment and credentials, and that stripped form is
  what the copy action, the share-to-X intent and the leaderboard use. The full
  URL is only shown back to the person who typed it.
- Sharing happens **only** on click: the share control is a plain link to an X
  intent URL. Nothing is posted anywhere on Word's behalf.

---

## Historical benchmark

Every result is compared with one fixed number: **1,521 words**, the length of
Oxford's English translation of *The Exaltation of Inana*, a poem attributed to
Enheduanna — the earliest author known by name. (Not her first writing, and not
the first text ever written.)

- **Source:** University of Oxford, Electronic Text Corpus of Sumerian
  Literature (ETCSL).
- **Translation:** https://etcsl.orinst.ox.ac.uk/section4/tr4072.htm
- **Scope:** the main English translation, lines 1-154.
- **Excluded from the count:** page navigation, the title, the footer and the
  revision history; superscript line numbers; and parenthetical editorial notes
  (alternative manuscript readings and uncertainty markers).
- **Configuration:** `src/lib/word/benchmark.ts` — the number, title, source,
  translation URL, counting-rule version and verification date, as structured
  data.

The app **never fetches Oxford during a user scan**, and the translation is not
republished here — the UI links to it.

Both numbers on the result screen come from the same expression, so they are
always comparable:

```js
text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0
```

Parenthetical stripping is specific to Oxford's editorial notes. **Users' pages
are counted as they are** — ordinary parentheses and their contents are not
removed.

### How the translation is found

The translation is selected **structurally**, not by matching Oxford's prose.
Every line of an ETCSL translation opens with its line range, and on the live
page the number runs straight into the text with no dot and no space —
`1-12Lady of all the divine powers` — so `scripts/benchmark-extract.mjs`
splits the page into its innermost text blocks and keeps the ones that start
that way. Everything else is page furniture: the catalogue navigation, the
title, the `Top | composite text | bibliography` footer, the revision history.

Three details this has to get right, each learned from a real run:

- **The number may not be punctuated.** The trailing dot and the whitespace are
  both optional, so `1-12Lady`, `1-4. Lady` and `5 - 154 Woman` all parse.
- **Matching a leading number is not enough.** The revision history opens with
  `27.i.1999-01.ii.1999 : JAB : adapting translation`, which also starts with
  digits. Rather than a rule about what revision histories look like, the kept
  blocks must form a **contiguous chain** from line 1, each starting exactly
  one line after the last ended. A dated entry can't join the chain and drops
  out.
- **Some words are separated by markup, not whitespace.** The page yields
  `the foreign lands bow low` only if element boundaries count as word breaks;
  otherwise it arrives as `bowlow` and counts once instead of twice. Every
  non-phrasing element boundary contributes a space — the same rule the app's
  own extractor uses, so both sides of the comparison treat markup alike.

It then strips the line number, removes parenthetical editorial notes, and
normalises whitespace.

It also checks its own work: extraction **fails** unless the chain runs from
line 1 to line 154. A paginated page, a truncated copy or a restructured one
produces an error and a dump of what was actually on the page — never a
plausible-looking wrong number.

### Re-verifying the number

```bash
npm run verify:benchmark                              # fetch Oxford live
npm run verify:benchmark -- --html path/to/saved.htm  # use a saved copy
```

It prints the first and last 200 characters of the extracted window so the
boundaries can be eyeballed, saves the fetched page to `scripts/.cache/`
(gitignored) for offline work, and exits `0` on a match, `1` on a mismatch,
`2` when it could not check at all. On failure it prints the page's text
blocks and how many numbered lines it recognised, which is what you need to
correct the rules.

If it mismatches, work out whether extraction or tokenisation moved — do not
quietly edit the constant — then bump `COUNTING_RULE_VERSION`.

> **Verified against the live page on 2026-09-27.** The run counted **1,521
> words**, matching the configured benchmark exactly. The extracted window was
> confirmed at both ends: it opens with *"Lady of all the divine powers,
> resplendent light, righteous woman clothed in radiance…"* (line 1) and closes
> with *"…to my lady enveloped in beauty, to Inana!"* (line 154).
>
> Getting there took three runs, and what the first two found is why the rules
> look the way they do. The environment Word was built in cannot reach
> `etcsl.orinst.ox.ac.uk`, so the first version of these rules was written
> against an assumed page and looked for hard-coded phrases that aren't on it.
> The second run got past fetching and showed the real structure: line numbers
> with no punctuation, a revision-history entry that also opens with digits,
> and — the one that would have mattered most — words separated by markup
> rather than whitespace, which would have quietly undercounted while looking
> perfectly plausible.
>
> Re-run the command after any change to the tokeniser or these rules.

### Author image

`public/enheduanna-disk.jpg`, shown beside the comparison and on the share
card, labelled **"Depiction of Enheduanna on an ancient disk."**

It is the artefact, not a likeness. No contemporary portrait of Enheduanna
exists, and a modern imagining presented as one would be a fabrication — the
label says exactly what the picture is and claims nothing more.

| | |
| --- | --- |
| Object | Disk of Enheduanna. Alabaster, c. 2350-2300 BCE, from Ur. Penn Museum, object B16665 |
| Creator | Mefman00 |
| Licence | CC0 1.0 Universal (Public Domain Dedication) — no conditions, attribution not required |
| Licence URL | https://creativecommons.org/publicdomain/zero/1.0/ |
| File page | https://commons.wikimedia.org/wiki/File:Disk_of_Enheduanna.JPG |
| Original | https://upload.wikimedia.org/wikipedia/commons/a/ad/Disk_of_Enheduanna.JPG |
| Modifications | Cropped square to the disk, resized to 480px (page) and 220px (card) |
| Licence verified | 2026-09-27, against the Commons file page's own metadata |

The licence was read from Commons' structured metadata rather than assumed, and
the same record confirmed the Penn Museum catalogue number. CC0 requires no
credit at all; Word credits the photographer anyway, under "How we count".

Two candidates were checked. The other, `Disk of Enheduanna (2).jpg`, is a
cropped and contrast-adjusted derivative under **CC BY 4.0** with attribution
required. The CC0 original was chosen: it is the source photograph and carries
no conditions.

All of this is configuration, in `AUTHOR_IMAGE` (`src/lib/word/benchmark.ts`).
To replace the image, swap the file, update that record, and regenerate the
inlined copy used by the card (`src/lib/word/author-image.ts`).

**Why the card inlines its own copy.** `next/og` renders inside the Worker, so
a remote fetch mid-render would add latency and a failure mode to every card.
The card carries a 220px base64 copy of the same photograph instead.

**Why it is masked to a circle.** The object is a disk, so a circular crop is
faithful to it — and the source is a museum-case photograph whose red display
plinth would otherwise show at the corners of a square frame. The disk's centre
and diameter were measured from the photograph rather than eyeballed.

---

## Saved results and sharing

Every successful scan is saved with an opaque 16-character id (80 bits of
randomness, Crockford-style base32 with no easily-misread characters).

| | |
| --- | --- |
| Public URL | `https://word.outship.dev/result/{id}` |
| Internal route | `/word/result/[id]` |
| Share card | `https://word.outship.dev/api/word/card/{id}` |
| Download | the same URL with `?download=1` |
| Storage | D1 table `WordResult` (`migrations/0004_add_word_result.sql`) |

- **Stable snapshots.** The count, the comparison direction and difference, the
  benchmark size and the counting-rule version are all stored at scan time, and
  the headline is rebuilt from *those* numbers. Changing the benchmark later
  does not rewrite old share links.
- **Only the query-stripped URL is stored** — never credentials, never query
  strings.
- **Disclosure.** The result screen says, in as many words, that sharing or
  downloading publishes the result at its URL and that anyone with the link can
  see the address and the counts. Leaderboard listing stays a separate opt-in.
- **Save failures are not scan failures.** If D1 is unavailable the count is
  still shown; the share and download actions are hidden and the UI says so.

### Metadata and the share card

`generateMetadata` in `src/app/word/result/[id]/page.tsx` builds the title,
description, canonical, Open Graph and `summary_large_image` Twitter tags from
the saved record, with absolute production URLs. They are in the **first HTML
response** — no login, no client-side JavaScript.

The card is a 1200x630 PNG rendered by `next/og` at
`src/app/api/word/card/[id]/route.tsx`, showing the domain, the word count, the
fewer/more/exact-match comparison, Word branding, "How wordy is your website?"
and word.outship.dev, with 64px safe margins.

It lives under `/api/` deliberately: API routes are excluded from the hostname
rewrite, so the image URL resolves identically on both hostnames with no
redirect and no internal `/word` prefix leaking into metadata. It is generated
**only from the saved record** — numbers can't be passed in through the query
string.

### Result screen

After a successful scan, and on every public result page:

1. The scanned domain and page.
2. The word count, animated up to the server-calculated number. The real number
   is what React renders (so it is in the HTML and survives JavaScript being
   off); the animation is a DOM-level enhancement that is skipped entirely under
   `prefers-reduced-motion: reduce`. Assistive technology is given the final
   value once, not every frame.
3. The historical comparison, the poem's name, and the clarification line.
4. Author context — text-only, see above.
5. Share on X, Download card, Copy result, Count another page.

Wording rules held in code and covered by tests: **"Your page has"**, never
"You wrote" — submitting a website does not establish authorship. Correct
singular and plural ("1 fewer word" / "479 more words"), thousands separators
throughout, and no claim of a record or of having out-written anyone's lifetime
output.

"Share on X" opens a composer the person still has to submit:

> My homepage has 2,000 words. That's 479 more than Enheduanna's poem. How wordy is yours?

"page" replaces "homepage" when the scan was not of a bare homepage.

**No AI model is involved** in counting or in any of this copy. It is
deterministic code and fixed templates.

---

## Leaderboard

A compact "Homepage leaderboard" on the Word page, backed by the existing D1
database (table `WordSite`, migration `migrations/0003_add_word.sql`).

- **Opt-in only.** A row exists only because someone ticked the box and pressed
  "Add to leaderboard" after a scan. Nothing is listed automatically.
- **Homepages only.** The opt-in endpoint refuses anything but a bare homepage,
  and the label says so.
- **Server-computed counts only.** `POST /api/word/leaderboard` takes a URL and
  nothing else, then re-runs `scanUrl` itself (usually a cache hit) and stores
  the number it computed. A client-supplied count is impossible to submit.
- **One entry per normalised hostname.** `normalizeHostname()` lowercases and
  drops a leading `www.`, and `hostname` is the table's primary key, so repeat
  scans update the existing row instead of adding another.
- Shows domain, homepage word count, and when it was last scanned.

Sponsored placement is **not** implemented — there are no payments in this
change. When it arrives it must be a separate, explicitly labelled slot; it must
not reorder or mix into the earned ranking above.

---

## API

### `POST /api/word/count`

```json
{ "url": "example.com" }
```

Responds with newline-delimited JSON so the UI can report real progress:

```
{"type":"phase","phase":"validating"}
{"type":"phase","phase":"fetching"}
{"type":"phase","phase":"counting"}
{"type":"phase","phase":"saving"}
{"type":"result","result":{
  "url": "...", "shareUrl": "...", "words": 1234, "characters": 7890, "scanMs": 412,
  "saved": {
    "id": "…", "url": "https://word.outship.dev/result/…",
    "cardUrl": "https://word.outship.dev/api/word/card/…",
    "isHomepage": true, "benchmarkWords": 1521, "benchmarkVersion": "…",
    "comparison": { "direction": "above", "difference": 479, "headline": "…" }
  }
}}
```

`saved` is `null` when the result could not be persisted; the count is still
correct and still shown, but there is no share link for it.

A failure after the stream opens arrives in-band as
`{"type":"error","code":"…","message":"…"}`. Problems detectable up front —
bad scheme, private host, odd port, unparseable input — return HTTP 400 with the
same shape, and rate limiting returns 429 with `retry-after`.

Error codes: `empty`, `unparseable`, `scheme`, `credentials`, `port`,
`hostname`, `private-address`, `dns-failed`, `dns-unverifiable`, `unreachable`,
`timeout`, `http-error`, `too-many-redirects`, `unsupported-content-type`,
`too-large`, `no-text`, `rate-limited`, `unknown`.

### `GET /api/word/leaderboard`

`{ "entries": [{ "hostname": "…", "url": "…", "wordCount": 1234, "lastScannedAt": "…" }] }`

### `POST /api/word/leaderboard`

`{ "url": "https://example.com/" }` — opt in. Recomputes the count server-side
and returns the refreshed leaderboard.

### `GET /api/word/card/{id}`

The 1200x630 PNG share card for a saved result. `?download=1` returns the same
image with a `Content-Disposition: attachment` header. 404 for an unknown or
malformed id.

### `GET /result/{id}` (`/word/result/[id]` internally)

The public result page. 404 (Word's own) for an unknown or malformed id.

---

## Tests

```bash
npm run test:word
```

Node's built-in test runner with type stripping — no test framework added.
`scripts/ts-resolve-hooks.mjs` teaches it this repo's extensionless imports and
`@/*` alias, so app code stays written the way the rest of the repo is.

Covers:

- Counting against a known HTML fixture: entities, hidden elements,
  scripts/styles/SVG/template, inline vs. block boundaries, code points vs.
  UTF-16 units.
- The word rule itself: apostrophes, hyphens, commas, symbols, empty input.
- URL and IP classification in every notation.
- With `fetch` stubbed, including DNS: redirect re-validation, redirect limits,
  content-type filtering, both size caps, timeouts, outbound header hygiene.
- Benchmark comparison copy below, equal to and above 1,521, singular and plural
  wording, thousands separators, and the absence of authorship or record claims.
- The X composer text for homepage and non-homepage scans.
- The ETCSL extraction rules, against a fixture shaped like the live page as
  observed from a real run: unpunctuated line numbers (`1-12Lady`) as well as
  the dotted and spaced forms; words separated by markup rather than
  whitespace; phrasing elements that must *not* break a word; the catalogue
  header, footer nav and dated revision history that must not be counted;
  nested wrappers that must not double-count; and the three ways extraction is
  required to fail loudly (no numbered lines, a chain that doesn't reach 154,
  and a gap in the chain). This proves the rules behave; it is not the same as
  reproducing the live 1,521, which is `npm run verify:benchmark`.
- Result ids: format, validity checking, collision resistance over 5,000
  samples, and that public URLs always use the production origin.

---

## Cloudflare configuration

Word ships with the existing Worker. There is no second Worker, no second
database, and no change to any existing route or binding.

### 1. Apply the migration

```bash
npx wrangler d1 migrations apply outship-db --local    # local development
npx wrangler d1 migrations apply outship-db --remote   # production
```

`migrations/0003_add_word.sql` creates `WordSite` and `WordRateLimit`;
`migrations/0004_add_word_result.sql` creates `WordResult`. Both add tables only
and touch nothing that already exists.

### 2. Attach the hostname

Domains for this Worker are managed in the Cloudflare dashboard — `wrangler.jsonc`
has no `routes` key, and it deliberately still doesn't, so adding Word cannot
disturb the existing outship.dev association.

In the dashboard: **Workers & Pages → `outship` → Settings → Domains & Routes →
Add → Custom domain → `word.outship.dev`**.

Cloudflare creates the proxied DNS record and issues the certificate itself.
`word.outship.dev` must be in the same zone (`outship.dev`) as the existing
custom domain. Leave `outship.dev` exactly as it is.

If you would rather manage domains in code, add **both** to `wrangler.jsonc` in
the same change — listing only Word would drop outship.dev:

```jsonc
"routes": [
  { "pattern": "outship.dev", "custom_domain": true },
  { "pattern": "word.outship.dev", "custom_domain": true }
]
```

(Match `pattern` to whatever the dashboard currently shows for the existing
domain, including `www` if it is configured.)

### 3. Check for host-level redirects

Word relies on requests reaching the Worker with `Host: word.outship.dev`. Before
going live, confirm nothing sends the subdomain back to the apex:

- **Rules → Redirect Rules** and **Bulk Redirects** — no rule matching
  `*.outship.dev` or `word.outship.dev`.
- **Rules → Page Rules** (if any legacy ones remain) — no forwarding rule on the
  subdomain.
- **SSL/TLS → Edge Certificates → Always Use HTTPS** is fine (it only upgrades
  the scheme) — an apex-normalising redirect is not.
- **DNS** — `word` is a proxied (orange-cloud) record pointing at the Worker,
  not a CNAME to `outship.dev`.

### 4. Deploy

Unchanged from before:

```bash
npm run deploy
```

or let the dashboard's Workers Builds pipeline run it on push.

### Not verified from here

Three things could not be checked in the environment this was built in — its
network policy blocks Oxford, Wikimedia, `*.workers.dev` and outship's own
domains. None were code changes; all three needed a human with the right
access. Two are now done, kept here with their results rather than deleted.

1. ~~**The domain association and HTTPS.**~~ **Done** — `word.outship.dev` is
   attached to the Worker and serves over HTTPS. Verified against production:

   | Request | Result |
   | --- | --- |
   | `https://word.outship.dev/` | `200`, no `location:` header — nothing redirects the subdomain to the apex |
   | `https://word.outship.dev/word` | `308` to `/` — one canonical URL per page |
   | `https://word.outship.dev/nope` | `404` — Word's own, not outship's |
   | `https://outship.dev/` | `200` — the existing site is unaffected |
   | `href="/word"` in the served HTML | absent — the internal prefix stays internal |
2. ~~**The 1,521 benchmark.**~~ **Done** — verified against the live page on
   2026-09-27, counting 1,521 words with the window confirmed at both ends.
   Re-run `npm run verify:benchmark` after any change to the tokeniser or the
   extraction rules; it needs a network that can reach Oxford.
3. **The X link preview.** Still open. The metadata and the card were verified
   directly — correct tags in the first HTML response, a real 1200x630 PNG
   from the Workers runtime on both hostnames. That is not the same as X
   having fetched and cached the preview. Paste a result URL into X's Card
   Validator (or post it once) and confirm the large image renders; X caches
   aggressively, so a stale preview after a change is expected and needs a
   re-scrape, not a code fix.

   Also still unexercised: a scan of a real website on the live site. Every
   network path in the test suite is stubbed, and the local runtime could not
   reach the internet, so the first genuine run of DNS-over-HTTPS validation
   against a real host happens in production.

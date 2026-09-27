/**
 * Tests for Word's page fetcher and scan orchestration.
 *
 * Run with: npm run test:word
 * `fetch` is stubbed — including the DNS-over-HTTPS lookup — so redirect
 * re-validation, the size cap, content-type filtering, timeouts and header
 * hygiene are all checked without touching the network.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PageFetchError, fetchPageHtml } from "../fetch-page";
import { ScanError, scanUrl } from "../scan";
import { createDeadline } from "../signals";

const DOH_HOST = "doh.test";
process.env.WORD_DNS_RESOLVER = `https://${DOH_HOST}/dns-query`;

type RequestRecord = { url: URL; headers: Headers };
type Handler = (url: URL, init: RequestInit & { headers: Headers }) => Response | Promise<Response>;

/** Replace global fetch for the duration of `body`, recording every request. */
async function withStubbedFetch(
  handler: Handler,
  body: (requests: RequestRecord[]) => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  const requests: RequestRecord[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof URL ? input.href : String(input));
    const headers = new Headers(init?.headers);

    // Answer DNS-over-HTTPS lookups with a public address.
    if (url.hostname === DOH_HOST) {
      const type = url.searchParams.get("type");
      return Response.json({
        Status: 0,
        Answer:
          type === "A"
            ? [{ name: url.searchParams.get("name") ?? "", type: 1, data: "93.184.216.34" }]
            : [],
      });
    }

    requests.push({ url, headers });
    return handler(url, { ...init, headers });
  }) as typeof fetch;

  try {
    await body(requests);
  } finally {
    globalThis.fetch = original;
  }
}

function html(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init,
  });
}

async function expectFetchFailure(
  handler: Handler,
  url: string,
  reason: string,
): Promise<void> {
  await withStubbedFetch(handler, async () => {
    const deadline = createDeadline(5_000);
    try {
      await fetchPageHtml(new URL(url), deadline.signal);
      assert.fail(`expected ${reason}`);
    } catch (error) {
      assert.ok(error instanceof PageFetchError, `expected PageFetchError, got ${error}`);
      assert.equal(error.reason, reason);
    } finally {
      deadline.release();
    }
  });
}

test("fetches HTML and reports the final URL", async () => {
  await withStubbedFetch(
    () => html("<html><body><p>one two three</p></body></html>"),
    async () => {
      const deadline = createDeadline(5_000);
      const page = await fetchPageHtml(new URL("https://example.com/"), deadline.signal);
      deadline.release();

      assert.equal(page.finalUrl, "https://example.com/");
      assert.equal(page.redirects, 0);
      assert.equal(page.contentType, "text/html");
      assert.match(page.html, /one two three/);
    },
  );
});

test("forwards no cookies, auth or client headers", async () => {
  await withStubbedFetch(
    () => html("<p>hi</p>"),
    async (requests) => {
      const deadline = createDeadline(5_000);
      await fetchPageHtml(new URL("https://example.com/"), deadline.signal);
      deadline.release();

      const sent = requests[0]!.headers;
      assert.equal(sent.get("cookie"), null);
      assert.equal(sent.get("authorization"), null);
      assert.equal(sent.get("x-forwarded-for"), null);
      assert.match(sent.get("user-agent") ?? "", /^WordBot\//);
      assert.match(sent.get("accept") ?? "", /text\/html/);
    },
  );
});

test("follows a redirect and counts the hop", async () => {
  await withStubbedFetch(
    (url) =>
      url.pathname === "/"
        ? new Response(null, { status: 301, headers: { location: "/final" } })
        : html("<p>landed</p>"),
    async () => {
      const deadline = createDeadline(5_000);
      const page = await fetchPageHtml(new URL("https://example.com/"), deadline.signal);
      deadline.release();

      assert.equal(page.finalUrl, "https://example.com/final");
      assert.equal(page.redirects, 1);
    },
  );
});

test("rejects a redirect into private address space", async () => {
  const cases = [
    ["http://169.254.169.254/latest/meta-data/", "private-address"],
    ["http://127.0.0.1:8080/", "private-address"],
    ["http://10.0.0.1/", "private-address"],
    ["http://[::1]/", "private-address"],
    ["http://localhost/", "hostname"],
  ] as const;

  for (const [location, reason] of cases) {
    await expectFetchFailure(
      () => new Response(null, { status: 302, headers: { location } }),
      "https://example.com/",
      reason,
    );
  }
});

test("rejects a redirect to a non-web scheme or port", async () => {
  await expectFetchFailure(
    () => new Response(null, { status: 302, headers: { location: "file:///etc/passwd" } }),
    "https://example.com/",
    "scheme",
  );
  await expectFetchFailure(
    () => new Response(null, { status: 302, headers: { location: "http://example.com:22/" } }),
    "https://example.com/",
    "port",
  );
});

test("gives up on a redirect chain", async () => {
  let hop = 0;
  await expectFetchFailure(
    () => {
      hop += 1;
      return new Response(null, { status: 302, headers: { location: `/hop-${hop}` } });
    },
    "https://example.com/",
    "too-many-redirects",
  );
});

test("accepts HTML responses only", async () => {
  await expectFetchFailure(
    () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    "https://example.com/",
    "unsupported-content-type",
  );
  await expectFetchFailure(
    () => new Response("PDF", { status: 200, headers: { "content-type": "application/pdf" } }),
    "https://example.com/",
    "unsupported-content-type",
  );
  await expectFetchFailure(
    () => new Response("<p>hi</p>", { status: 200 }),
    "https://example.com/",
    "unsupported-content-type",
  );
});

test("surfaces HTTP errors", async () => {
  await expectFetchFailure(
    () => new Response("nope", { status: 404, headers: { "content-type": "text/html" } }),
    "https://example.com/",
    "http-error",
  );
});

test("rejects an oversized page declared by content-length", async () => {
  await expectFetchFailure(
    () =>
      new Response("<p>small body, big claim</p>", {
        status: 200,
        headers: { "content-type": "text/html", "content-length": "99000000" },
      }),
    "https://example.com/",
    "too-large",
  );
});

test("rejects an oversized page that streams past the cap", async () => {
  await expectFetchFailure(() => {
    const chunk = new TextEncoder().encode("<p>".padEnd(64 * 1024, "x"));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        // 4MB in total, double the 2MB cap.
        if (sent >= 64) {
          controller.close();
          return;
        }
        sent += 1;
        controller.enqueue(chunk);
      },
    });
    return new Response(stream, { status: 200, headers: { "content-type": "text/html" } });
  }, "https://example.com/", "too-large");
});

test("times out a page that never responds", async () => {
  await withStubbedFetch(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    async () => {
      const deadline = createDeadline(60);
      try {
        await fetchPageHtml(new URL("https://example.com/"), deadline.signal);
        assert.fail("expected a timeout");
      } catch (error) {
        assert.ok(error instanceof PageFetchError);
        assert.equal(error.reason, "timeout");
      } finally {
        deadline.release();
      }
    },
  );
});

test("refuses a hostname that resolves to a private address", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof URL ? input.href : String(input));
    if (url.hostname === DOH_HOST) {
      return Response.json({
        Status: 0,
        Answer:
          url.searchParams.get("type") === "A"
            ? [{ name: "rebind-target.net", type: 1, data: "192.168.7.7" }]
            : [],
      });
    }
    return assert.fail("should not have been fetched");
  }) as typeof fetch;

  const deadline = createDeadline(5_000);
  try {
    await fetchPageHtml(new URL("https://rebind-target.net/"), deadline.signal);
    assert.fail("expected the scan to be refused");
  } catch (error) {
    assert.ok(error instanceof PageFetchError);
    assert.equal(error.reason, "private-address");
  } finally {
    deadline.release();
    globalThis.fetch = original;
  }
});

test("scanUrl reports counts, phases and the shareable URL", async () => {
  await withStubbedFetch(
    () =>
      html(
        "<html><body><nav>Home</nav><h1>Hello world</h1><p>Three more words here</p></body></html>",
      ),
    async () => {
      const phases: string[] = [];
      const result = await scanUrl("example.com/page?token=secret", {
        onPhase: (phase) => phases.push(phase),
      });

      assert.deepEqual(phases, ["validating", "fetching", "counting"]);
      assert.equal(result.url, "https://example.com/page?token=secret");
      assert.equal(result.shareUrl, "https://example.com/page");
      // Home Hello world Three more words here
      assert.equal(result.words, 7);
      assert.equal(result.characters, "Home Hello world Three more words here".length);
      assert.equal(result.cached, false);
      assert.ok(result.scanMs >= 0);
    },
  );
});

test("scanUrl reports pages with no readable text", async () => {
  await withStubbedFetch(
    () => html("<html><body><script>var a = 1;</script><img src='x'></body></html>"),
    async () => {
      await assert.rejects(
        () => scanUrl("https://example.com/"),
        (error: unknown) => error instanceof ScanError && error.code === "no-text",
      );
    },
  );
});

test("scanUrl refuses unsafe input before any request", async () => {
  for (const [input, code] of [
    ["http://localhost/", "hostname"],
    ["http://169.254.169.254/", "private-address"],
    ["http://example.com:3000/", "port"],
    ["file:///etc/passwd", "scheme"],
    ["https://user:pw@example.com/", "credentials"],
  ] as const) {
    await withStubbedFetch(
      () => assert.fail("should not have been fetched"),
      async () => {
        await assert.rejects(
          () => scanUrl(input),
          (error: unknown) => error instanceof ScanError && error.code === code,
        );
      },
    );
  }
});

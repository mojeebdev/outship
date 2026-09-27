/**
 * Small AbortSignal helpers.
 *
 * Written against plain `AbortController` rather than `AbortSignal.timeout` /
 * `AbortSignal.any` so the same code runs on Node during local development and
 * on the Workers runtime in production, whatever each one has shipped.
 */

export type Deadline = {
  signal: AbortSignal;
  /** Clear the timer. Always call this once the work is done. */
  release: () => void;
  expired: () => boolean;
};

function abortError(name: "TimeoutError"): Error {
  const error = new Error("The operation timed out.");
  error.name = name;
  return error;
}

/** A signal that aborts after `ms`, with a `TimeoutError` reason. */
export function createDeadline(ms: number): Deadline {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(abortError("TimeoutError"));
  }, ms);

  return {
    signal: controller.signal,
    release: () => clearTimeout(timer),
    expired: () => timedOut,
  };
}

/**
 * Combine signals into one that aborts as soon as any input aborts.
 *
 * Returns `release` so the listeners and timer can be detached; long-lived
 * parent signals would otherwise accumulate listeners across requests.
 */
export function combineSignals(...signals: AbortSignal[]): Deadline {
  const controller = new AbortController();
  const cleanups: Array<() => void> = [];

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    const onAbort = () => controller.abort(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    cleanups.push(() => signal.removeEventListener("abort", onAbort));
  }

  return {
    signal: controller.signal,
    release: () => cleanups.forEach((cleanup) => cleanup()),
    expired: () => controller.signal.aborted,
  };
}

/** True when an error came from an abort or a timeout. */
export function isAbortLike(error: unknown): boolean {
  return (
    error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

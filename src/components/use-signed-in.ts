"use client";

import { useSyncExternalStore } from "react";
import { SIGNED_IN_HINT_COOKIE } from "@/lib/auth/signed-in-hint";

const subscribe = () => () => {};

const readHint = () =>
  document.cookie.split("; ").some((pair) => pair.startsWith(`${SIGNED_IN_HINT_COOKIE}=`));

/**
 * true or false in the browser, null while rendering on the server, so
 * pre-rendered pages show neither link until the browser knows which is right.
 */
export function useSignedIn(): boolean | null {
  return useSyncExternalStore(subscribe, readHint, () => null);
}

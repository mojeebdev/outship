/**
 * The Base Builder Code suffix: ERC-8021 schema 0, as Base's checker reads it.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { Attribution } from "ox/erc8021";
import { BASE_BUILDER_CODE, BUILDER_CODE_SUFFIX } from "../web3/builder-code";

test("the suffix ends with the 16-byte ERC-8021 marker", () => {
  assert.ok(BUILDER_CODE_SUFFIX.endsWith("80218021802180218021802180218021"));
});

test("the suffix carries the builder code, and reads back from a tx's calldata", () => {
  const code = Buffer.from(BASE_BUILDER_CODE, "ascii").toString("hex");
  assert.ok(BUILDER_CODE_SUFFIX.includes(code));
  // Any calldata with the suffix on the end attributes to outship.
  const calldata = `0xf17325e7${"00".repeat(64)}${BUILDER_CODE_SUFFIX.slice(2)}` as const;
  assert.deepEqual(Attribution.fromData(calldata)?.codes, [BASE_BUILDER_CODE]);
});

/**
 * The README badge snippets and the prompt for a builder's coding agent.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { badgeAgentPrompt, badgeSnippets } from "../badge-snippets";

test("the snippets link the badge image to the builder's profile", () => {
  const s = badgeSnippets("alice");
  assert.equal(s.markdown, "[![alice on outship](https://outship.dev/@alice/badge.svg)](https://outship.dev/@alice)");
  assert.match(s.html, /^<a href="https:\/\/outship\.dev\/@alice"><img src="https:\/\/outship\.dev\/@alice\/badge\.svg" alt="alice on outship" width="\d+" height="\d+"><\/a>$/);
});

test("the agent prompt carries the exact markdown line, on a line of its own", () => {
  const prompt = badgeAgentPrompt("alice");
  assert.ok(prompt.split("\n").includes(badgeSnippets("alice").markdown));
});

test("the agent prompt names the profile repo and keeps the rest of the README", () => {
  const prompt = badgeAgentPrompt("alice");
  assert.match(prompt, /github\.com\/alice\/alice/);
  assert.match(prompt, /Don't change anything else/);
  assert.match(prompt, /commit it with the message "Add outship badge"/);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  createWebLinkCookieValue,
  createWebLinkToken,
  parseWebLinkCookie,
  verifyWebLinkToken,
} from "./web-link-auth.ts";

const botToken = "123456:telegram-bot-secret";

test("creates deterministic user-scoped web link tokens", () => {
  const first = createWebLinkToken(botToken, 12345);
  const second = createWebLinkToken(botToken, 12345);

  assert.equal(first, second);
  assert.match(first, /^[a-f\d]{64}$/);
  assert.notEqual(first, createWebLinkToken(botToken, 54321));
});

test("verifies only the intended Telegram user", () => {
  const token = createWebLinkToken(botToken, 12345);

  assert.equal(verifyWebLinkToken(token, botToken, 12345), true);
  assert.equal(verifyWebLinkToken(token, botToken, 54321), false);
  assert.equal(verifyWebLinkToken("invalid", botToken, 12345), false);
});

test("round-trips a signed web link cookie", () => {
  const token = createWebLinkToken(botToken, 12345);
  const cookie = createWebLinkCookieValue(12345, token);

  assert.equal(parseWebLinkCookie(cookie, botToken), 12345);
  assert.equal(parseWebLinkCookie(`${cookie}0`, botToken), null);
  assert.equal(parseWebLinkCookie(undefined, botToken), null);
});

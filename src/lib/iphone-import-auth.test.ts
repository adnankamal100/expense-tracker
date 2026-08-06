import assert from "node:assert/strict";
import test from "node:test";
import {
  createIphoneImportToken,
  verifyIphoneImportToken,
} from "./iphone-import-auth.ts";

test("creates deterministic user-scoped iPhone import tokens", () => {
  const first = createIphoneImportToken("bot-secret", 123);
  const repeated = createIphoneImportToken("bot-secret", 123);
  const anotherUser = createIphoneImportToken("bot-secret", 456);

  assert.match(first, /^[a-f\d]{64}$/);
  assert.equal(first, repeated);
  assert.notEqual(first, anotherUser);
  assert.equal(
    verifyIphoneImportToken(first, "bot-secret", 123),
    true,
  );
  assert.equal(
    verifyIphoneImportToken(first, "bot-secret", 456),
    false,
  );
  assert.equal(
    verifyIphoneImportToken("invalid", "bot-secret", 123),
    false,
  );
});

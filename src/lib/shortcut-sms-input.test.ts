import assert from "node:assert/strict";
import test from "node:test";
import { getShortcutSmsText } from "./shortcut-sms-input.ts";

const outgoingSms = [
  "Sent Rs.24.00",
  "From HDFC Bank A/C *5546",
  "To BMTC",
  "On 06/08/26",
  "Ref xx",
].join("\n");

test("keeps plain Shortcut text", () => {
  assert.equal(getShortcutSmsText(outgoingSms), outgoingSms);
});

test("extracts SMS content from an iPhone Message object", () => {
  assert.equal(
    getShortcutSmsText({
      sender: "+91 12345 67890",
      content: outgoingSms,
      receivedAt: "2026-08-06T12:00:00+05:30",
    }),
    outgoingSms,
  );
});

test("extracts SMS content from a nested Shortcut input list", () => {
  assert.equal(
    getShortcutSmsText([{ message: { body: outgoingSms } }]),
    outgoingSms,
  );
});

test("does not mistake Message metadata for SMS text", () => {
  assert.equal(
    getShortcutSmsText({ sender: "HDFCBK", receivedAt: "today" }),
    "",
  );
});

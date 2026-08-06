import assert from "node:assert/strict";
import test from "node:test";
import { parseHdfcSms } from "./hdfc-sms-parser.ts";

const superMoneySms = `Sent Rs.24.00
From HDFC Bank A/C *5546
To BMTC
On 06/08/26
Ref 123456789
Not You?
Call 18002586161/SMS BLOCK UPI to 7308080808`;

const googlePaySms = `Sent Rs.2000.00
From HDFC Bank A/C *5546
To PRANAV S MADHAV
On 05/08/26
Ref 987654321
Not You?
Call 18002586161/SMS BLOCK UPI to 7308080808`;

const creditSms =
  "Credit Alert!\nRs.1000.00 credited to HDFC Bank A/c XX5546 on 01-08-26 from VPA someone@okicici (UPI 123456)";

test("parses a Super.money HDFC debit SMS", () => {
  assert.deepEqual(parseHdfcSms(superMoneySms), {
    ok: true,
    value: {
      accountSuffix: "5546",
      amount: 24,
      category: "Transport",
      expenseDate: "2026-08-06",
      payee: "BMTC",
      reference: "123456789",
    },
  });
});

test("parses a Google Pay friend payment with Windows line endings", () => {
  assert.deepEqual(parseHdfcSms(googlePaySms), {
    ok: true,
    value: {
      accountSuffix: "5546",
      amount: 2000,
      category: "Other",
      expenseDate: "2026-08-05",
      payee: "PRANAV S MADHAV",
      reference: "987654321",
    },
  });
});

test("parses an iPhone Shortcut message collapsed to one line", () => {
  const collapsed = superMoneySms.replace(/\n/g, " ");

  assert.deepEqual(parseHdfcSms(collapsed), parseHdfcSms(superMoneySms));
});

test("ignores incoming credits", () => {
  assert.deepEqual(parseHdfcSms(creditSms), {
    ok: false,
    ignored: true,
    reason: "credit",
  });
});

test("rejects malformed outgoing alerts", () => {
  assert.deepEqual(
    parseHdfcSms(superMoneySms.replace("06/08/26", "31/02/26")),
    {
      ok: false,
      ignored: false,
      reason: "invalid_date",
    },
  );
  assert.deepEqual(parseHdfcSms(superMoneySms.replace("Ref 123456789", "Ref")), {
    ok: false,
    ignored: false,
    reason: "missing_reference",
  });
  assert.deepEqual(parseHdfcSms("Your OTP is 123456"), {
    ok: false,
    ignored: true,
    reason: "not_hdfc_outgoing",
  });
});

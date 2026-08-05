import assert from "node:assert/strict";
import test from "node:test";
import {
  parseDebtInput,
  parseDebtQuery,
  parseMoneyDate,
  type DebtParseFailureReason,
  type DebtType,
} from "./telegram-debt-parser.ts";

const now = new Date("2026-08-05T12:00:00Z");

function expectDebt(
  input: string,
  expected: {
    amount: number;
    date?: string;
    description?: string | null;
    person: string;
    type: DebtType;
  },
) {
  const result = parseDebtInput(input, now);

  assert.equal(result.ok, true, `${input} should parse`);

  if (!result.ok) {
    return;
  }

  assert.deepEqual(result.value, {
    amount: expected.amount,
    description: expected.description ?? null,
    personName: expected.person,
    recordType: expected.type,
    moneyDate: expected.date ?? "2026-08-05",
  });
}

function expectFailure(input: string, reason: DebtParseFailureReason) {
  assert.deepEqual(parseDebtInput(input, now), { ok: false, reason });
}

test("understands ways the user borrowed money", () => {
  const cases = [
    ["borrowed 500 Rahul", 500, "Rahul"],
    ["borrowed 50 Rahul", 50, "Rahul"],
    ["borrow ₹500 from Rahul", 500, "Rahul"],
    ["I borrowed Rs. 1,250.50 from Rahul Kumar", 1250.5, "Rahul Kumar"],
    ["borrowed from Rahul 500", 500, "Rahul"],
    ["borrowed Rahul 500", 500, "Rahul"],
    ["500 borrowed from Rahul", 500, "Rahul"],
    ["I owe Rahul 500", 500, "Rahul"],
    ["owe 500 to Rahul", 500, "Rahul"],
    ["Rahul lent me 500", 500, "Rahul"],
    ["Rahul gave 500 to me", 500, "Rahul"],
    ["got 500 from Rahul", 500, "Rahul"],
    ["received INR 500 from Rahul", 500, "Rahul"],
  ] as const;

  for (const [input, amount, person] of cases) {
    expectDebt(input, {
      amount,
      person,
      type: "BORROWED",
    });
  }
});

test("understands ways the user lent money", () => {
  const cases = [
    ["lent 700 Bhavya", 700, "Bhavya"],
    ["leant ₹700 to Bhavya", 700, "Bhavya"],
    ["lend Bhavya 700", 700, "Bhavya"],
    ["I lent money to Bhavya Rs 700", 700, "Bhavya"],
    ["700 lent to Bhavya", 700, "Bhavya"],
    ["Bhavya borrowed 700 from me", 700, "Bhavya"],
    ["Bhavya owes me 700", 700, "Bhavya"],
    ["gave Bhavya 700", 700, "Bhavya"],
    ["I gave 700 to Bhavya", 700, "Bhavya"],
  ] as const;

  for (const [input, amount, person] of cases) {
    expectDebt(input, { amount, person, type: "LENT" });
  }
});

test("accepts Indian and international amount formatting", () => {
  expectDebt("borrowed 1,00,000 Rahul", {
    amount: 100000,
    person: "Rahul",
    type: "BORROWED",
  });
  expectDebt("lent 100,000.25 Bhavya", {
    amount: 100000.25,
    person: "Bhavya",
    type: "LENT",
  });
  expectDebt("borrowed 500/- Rahul", {
    amount: 500,
    person: "Rahul",
    type: "BORROWED",
  });
  expectDebt("lent 500rs Bhavya", {
    amount: 500,
    person: "Bhavya",
    type: "LENT",
  });
  expectDebt("borrowed 1.5k Rahul", {
    amount: 1500,
    person: "Rahul",
    type: "BORROWED",
  });
  expectDebt("lent 1.25 lakh Bhavya", {
    amount: 125000,
    person: "Bhavya",
    type: "LENT",
  });
  expectDebt("borrowed 500₹ Rahul", {
    amount: 500,
    person: "Rahul",
    type: "BORROWED",
  });
});

test("supports relative, named, numeric and implicit dates", () => {
  const cases = [
    ["borrowed 500 Rahul today", "2026-08-05"],
    ["borrowed 500 Rahul on today", "2026-08-05"],
    ["borrowed 500 Rahul yesterday", "2026-08-04"],
    ["lent 500 Rahul day before yesterday", "2026-08-03"],
    ["lent 500 Rahul on 13th July", "2026-07-13"],
    ["lent 500 Rahul 13th July", "2026-07-13"],
    ["lent 500 Rahul on July 13th 2024", "2024-07-13"],
    ["lent 500 Rahul on 13/07/26", "2026-07-13"],
    ["lent 500 Rahul 13-07-2024", "2024-07-13"],
    ["lent 500 Rahul on 2024-07-13", "2024-07-13"],
    ["borrowed 500 Rahul on 31st December", "2025-12-31"],
  ] as const;

  for (const [input, date] of cases) {
    expectDebt(input, {
      amount: 500,
      date,
      person: "Rahul",
      type: input.startsWith("borrowed") ? "BORROWED" : "LENT",
    });
  }
});

test("handles whitespace, punctuation and Unicode names", () => {
  expectDebt("  BORROWED   ₹500   Rahul Kumar!!! ", {
    amount: 500,
    person: "Rahul Kumar",
    type: "BORROWED",
  });
  expectDebt("lent 700 Mary O’Connor", {
    amount: 700,
    person: "Mary O'Connor",
    type: "LENT",
  });
  expectDebt("lent 700 राहुल", {
    amount: 700,
    person: "राहुल",
    type: "LENT",
  });
});

test("captures an optional note without including it in the name", () => {
  expectDebt("lent 500 Rahul for lunch yesterday", {
    amount: 500,
    date: "2026-08-04",
    description: "lunch",
    person: "Rahul",
    type: "LENT",
  });
  expectDebt("borrowed 900 from Bhavya note: emergency on 13 July", {
    amount: 900,
    date: "2026-07-13",
    description: "emergency",
    person: "Bhavya",
    type: "BORROWED",
  });
  expectDebt("borrowed 900 from Bhavya on 13 July for emergency", {
    amount: 900,
    date: "2026-07-13",
    description: "emergency",
    person: "Bhavya",
    type: "BORROWED",
  });
});

test("rejects incomplete, invalid and ambiguous debt messages", () => {
  const cases: Array<[string, DebtParseFailureReason]> = [
    ["500 for coffee", "not_debt"],
    ["borrowed money from Rahul", "missing_amount"],
    ["borrowed 500", "missing_person"],
    ["I owe 500", "missing_person"],
    ["received 500", "missing_person"],
    ["lent 700 someone", "missing_person"],
    ["borrowed 0 Rahul", "invalid_amount"],
    ["borrowed -500 Rahul", "invalid_amount"],
    ["borrowed 500.123 Rahul", "invalid_amount"],
    ["borrowed 1,2,3 Rahul", "invalid_amount"],
    ["lent 500 Rahul on 31st February", "invalid_date"],
    ["lent 500 Rahul on Friday", "invalid_date"],
    ["lent 500 Rahul 31st February", "invalid_date"],
    ["loan 500 Rahul", "unrecognized_format"],
    ["paid 500 for coffee", "not_debt"],
  ];

  for (const [input, reason] of cases) {
    expectFailure(input, reason);
  }
});

test("date parser validates leap years", () => {
  assert.equal(parseMoneyDate("29 February 2024", now), "2024-02-29");
  assert.equal(parseMoneyDate("29 February 2025", now), null);
});

test("understands person-specific balance questions", () => {
  const cases = [
    ["how much do I owe Bhavya?", "BALANCE", "Bhavya"],
    ["show how much I owe Nandu", "BALANCE", "Nandu"],
    ["shoow how much i owe nandu", "BALANCE", "nandu"],
    ["tell me how much I owe Nandu", "BALANCE", "Nandu"],
    ["please check how much I owe Nandu", "BALANCE", "Nandu"],
    ["what do I owe to Rahul", "BALANCE", "Rahul"],
    ["how much does Bhavya owe me", "BALANCE", "Bhavya"],
    ["balance with Rahul", "BALANCE", "Rahul"],
    ["what's my balance with Rahul Kumar", "BALANCE", "Rahul Kumar"],
    ["Bhavya balance", "BALANCE", "Bhavya"],
    ["show debts for Bhavya", "BALANCE", "Bhavya"],
    ["how much did I borrow from Bhavya", "BORROWED", "Bhavya"],
    ["shoow me how much I borrowed from Bhavya", "BORROWED", "Bhavya"],
    ["how much borrowed from Bhavya", "BORROWED", "Bhavya"],
    ["total borrowed from Bhavya", "BORROWED", "Bhavya"],
    ["how much have I borrowed from Rahul", "BORROWED", "Rahul"],
    ["show what I borrowed from Rahul", "BORROWED", "Rahul"],
    ["how much did I lend Bhavya", "LENT", "Bhavya"],
    ["tell me how much I lent Bhavya", "LENT", "Bhavya"],
    ["how much lent to Bhavya", "LENT", "Bhavya"],
    ["total lent to Bhavya", "LENT", "Bhavya"],
    ["how much has Bhavya borrowed from me", "LENT", "Bhavya"],
  ] as const;

  for (const [input, kind, personName] of cases) {
    assert.deepEqual(parseDebtQuery(input), { kind, personName });
  }

  assert.equal(parseDebtQuery("borrowed 500 Bhavya"), null);
  assert.equal(parseDebtQuery("500 for coffee"), null);
});

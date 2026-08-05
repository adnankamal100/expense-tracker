import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDebtSummary,
  buildPersonDebtBreakdown,
  getPersonBalance,
  type DebtRecord,
} from "./debt-summary.ts";

const bhavyaDebts: DebtRecord[] = [
  {
    amount: 500,
    created_at: "2026-07-13T09:00:00Z",
    description: "Lunch",
    due_date: "2026-07-13",
    person_name: "Bhavya",
    record_type: "BORROWED",
    status: "OPEN",
  },
  {
    amount: 1000,
    created_at: "2026-08-01T09:00:00Z",
    description: null,
    due_date: "2026-08-01",
    person_name: "bhavya",
    record_type: "BORROWED",
    status: "OPEN",
  },
];

test("combines repeated borrowing and lists each entry", () => {
  const message = buildPersonDebtBreakdown(
    bhavyaDebts,
    "BHAVYA",
    "BALANCE",
  );

  assert.match(message, /Net balance: You owe Bhavya ₹1,500\.00/);
  assert.match(message, /Borrowed from Bhavya: ₹1,500\.00/);
  assert.match(message, /Lent to Bhavya: ₹0\.00/);
  assert.match(message, /• ₹500\.00 — 13 Jul 2026 — Lunch/);
  assert.match(message, /• ₹1,000\.00 — 1 Aug 2026/);
  assert.equal(getPersonBalance(bhavyaDebts, "Bhavya"), -1500);
});

test("shows gross borrowed/lent totals before the net split", () => {
  const debts: DebtRecord[] = [
    ...bhavyaDebts,
    {
      amount: 700,
      due_date: "2026-08-03",
      person_name: "Bhavya",
      record_type: "LENT",
      status: "OPEN",
    },
  ];
  const message = buildPersonDebtBreakdown(debts, "Bhavya", "BALANCE");

  assert.match(message, /Net balance: You owe Bhavya ₹800\.00/);
  assert.match(message, /Borrowed from Bhavya: ₹1,500\.00/);
  assert.match(message, /Lent to Bhavya: ₹700\.00/);
  assert.match(message, /Bhavya borrowed from you:\n• ₹700\.00/);
});

test("filters borrowed and lent questions to their respective entries", () => {
  const debts: DebtRecord[] = [
    ...bhavyaDebts,
    {
      amount: 700,
      due_date: "2026-08-03",
      person_name: "Bhavya",
      record_type: "LENT",
      status: "OPEN",
    },
  ];
  const borrowed = buildPersonDebtBreakdown(
    debts,
    "Bhavya",
    "BORROWED",
  );
  const lent = buildPersonDebtBreakdown(debts, "Bhavya", "LENT");

  assert.match(borrowed, /Total: ₹1,500\.00/);
  assert.doesNotMatch(borrowed, /₹700\.00/);
  assert.match(lent, /Total: ₹700\.00/);
  assert.doesNotMatch(lent, /₹1,000\.00/);
});

test("ignores settled records and handles unknown people", () => {
  const debts: DebtRecord[] = [
    ...bhavyaDebts,
    {
      amount: 9000,
      person_name: "Bhavya",
      record_type: "BORROWED",
      status: "SETTLED",
    },
  ];

  assert.equal(getPersonBalance(debts, "Bhavya"), -1500);
  assert.equal(
    buildPersonDebtBreakdown(debts, "Rahul", "BALANCE"),
    "No open borrowed or lent entries found for Rahul.",
  );
});

test("all-person summary includes net and gross totals", () => {
  const message = buildDebtSummary([
    ...bhavyaDebts,
    {
      amount: 250,
      person_name: "Rahul",
      record_type: "LENT",
      status: "OPEN",
    },
  ]);

  assert.match(message, /You owe Bhavya ₹1,500\.00/);
  assert.match(message, /Borrowed: ₹1,500\.00 · Lent: ₹0\.00/);
  assert.match(message, /Rahul owes you ₹250\.00/);
});

test("keeps a detailed Telegram response inside one message", () => {
  const manyEntries: DebtRecord[] = Array.from(
    { length: 150 },
    (_, index) => ({
      amount: index + 1,
      description: `Entry ${index + 1} with a deliberately long note for message sizing`,
      due_date: "2026-08-05",
      person_name: "Bhavya",
      record_type: "BORROWED",
      status: "OPEN",
    }),
  );
  const message = buildPersonDebtBreakdown(
    manyEntries,
    "Bhavya",
    "BALANCE",
  );

  assert.ok(message.length < 4096);
  assert.match(message, /more entries are available on the dashboard/);
});

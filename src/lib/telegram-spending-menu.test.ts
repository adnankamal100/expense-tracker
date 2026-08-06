import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSpendingMenu,
  getSpendingDateRange,
  parseSpendingCallbackData,
  type SpendingExpense,
} from "./telegram-spending-menu.ts";

const thursdayInIndia = new Date("2026-08-05T20:00:00Z");

test("calculates Today, Monday-based Week and Month in India time", () => {
  assert.deepEqual(
    getSpendingDateRange("today", thursdayInIndia),
    { startDate: "2026-08-06", endDate: "2026-08-06" },
  );
  assert.deepEqual(
    getSpendingDateRange("week", thursdayInIndia),
    { startDate: "2026-08-03", endDate: "2026-08-06" },
  );
  assert.deepEqual(
    getSpendingDateRange("month", thursdayInIndia),
    { startDate: "2026-08-01", endDate: "2026-08-06" },
  );
});

test("builds a sorted category breakdown for the selected period", () => {
  const expenses: SpendingExpense[] = [
    { amount: 500, category: "Food", expense_date: "2026-08-06" },
    { amount: 300, category: "Transport", expense_date: "2026-08-05" },
    { amount: 200, category: "Food", expense_date: "2026-08-03" },
    { amount: 9000, category: "Bills", expense_date: "2026-07-31" },
    { amount: 8000, category: "Shopping", expense_date: "2026-08-07" },
  ];
  const menu = buildSpendingMenu(expenses, "week", thursdayInIndia);

  assert.match(menu.text, /This week/);
  assert.match(menu.text, /Total: ₹1,000\.00/);
  assert.match(menu.text, /Transactions: 3/);
  assert.match(menu.text, /Food: ₹700\.00 \(70%\)/);
  assert.match(menu.text, /Transport: ₹300\.00 \(30%\)/);
  assert.doesNotMatch(menu.text, /Bills|Shopping/);
  assert.deepEqual(
    menu.replyMarkup.inline_keyboard[0].map((button) => button.text),
    ["Today", "✅ Week", "Month"],
  );
});

test("keeps period buttons when no expenses exist", () => {
  const menu = buildSpendingMenu([], "today", thursdayInIndia);

  assert.match(menu.text, /Total: ₹0\.00/);
  assert.match(menu.text, /No expenses found for this period/);
  assert.equal(menu.replyMarkup.inline_keyboard[0].length, 3);
});

test("accepts only supported spending callbacks", () => {
  assert.equal(parseSpendingCallbackData("spending:today"), "today");
  assert.equal(parseSpendingCallbackData("spending:week"), "week");
  assert.equal(parseSpendingCallbackData("spending:month"), "month");
  assert.equal(parseSpendingCallbackData("spending:year"), null);
  assert.equal(parseSpendingCallbackData("debts:page:0"), null);
});

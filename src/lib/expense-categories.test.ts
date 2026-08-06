import assert from "node:assert/strict";
import test from "node:test";
import {
  detectExpenseCategory,
  expenseCategories,
} from "./expense-categories.ts";

test("exposes the complete ordered category list", () => {
  assert.deepEqual(expenseCategories, [
    "Food",
    "Groceries",
    "Transport",
    "Bills",
    "Housing",
    "Shopping",
    "Health",
    "Entertainment",
    "Subscriptions",
    "Education",
    "Travel",
    "Other",
  ]);
});

test("detects every supported expense category", () => {
  const cases = [
    ["Dinner at a restaurant", "Food"],
    ["Groceries from supermarket", "Groceries"],
    ["Uber to office", "Transport"],
    ["BMTC", "Transport"],
    ["Electricity bill", "Bills"],
    ["Monthly house rent", "Housing"],
    ["Bought shoes on Flipkart", "Shopping"],
    ["Medicine from pharmacy", "Health"],
    ["Movie ticket", "Entertainment"],
    ["Netflix subscription", "Subscriptions"],
    ["Online university course", "Education"],
    ["Flight and hotel for vacation", "Travel"],
    ["Gift for Rahul", "Other"],
  ] as const;

  for (const [description, expectedCategory] of cases) {
    assert.equal(
      detectExpenseCategory(description),
      expectedCategory,
      description,
    );
  }
});

test("matches whole words and prefers the most specific phrase", () => {
  assert.equal(detectExpenseCategory("restaurant bill"), "Food");
  assert.equal(detectExpenseCategory("apartment maintenance bill"), "Housing");
  assert.equal(detectExpenseCategory("Netflix movie subscription"), "Subscriptions");
  assert.equal(detectExpenseCategory("restaurant"), "Food");
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDebtBackButton,
  buildDebtMenu,
  parseDebtCallbackData,
} from "./telegram-debt-menu.ts";
import type { DebtRecord } from "./debt-summary.ts";

test("builds one clickable row per outstanding person", () => {
  const debts: DebtRecord[] = [
    {
      id: 10,
      amount: 1000,
      person_name: "Nandu",
      record_type: "BORROWED",
      status: "OPEN",
    },
    {
      id: 11,
      amount: 250,
      person_name: "Bhavya",
      record_type: "LENT",
      status: "OPEN",
    },
    {
      id: 12,
      amount: 250,
      person_name: "bhavya",
      record_type: "BORROWED",
      status: "OPEN",
    },
    {
      id: 13,
      amount: 500,
      person_name: "Settled Person",
      record_type: "LENT",
      status: "SETTLED",
    },
  ];
  const menu = buildDebtMenu(debts);

  assert.match(menu.text, /1 person with an outstanding balance/);
  assert.equal(menu.replyMarkup?.inline_keyboard.length, 1);
  assert.match(
    menu.replyMarkup?.inline_keyboard[0][0].text ?? "",
    /Nandu.*you owe.*1,000/,
  );
  assert.equal(
    menu.replyMarkup?.inline_keyboard[0][0].callback_data,
    "debts:person:10:0",
  );
});

test("paginates long people lists and keeps callback data compact", () => {
  const debts: DebtRecord[] = Array.from({ length: 9 }, (_, index) => ({
    id: index + 1,
    amount: 100 + index,
    person_name: `Person ${index + 1}`,
    record_type: "LENT",
    status: "OPEN",
  }));
  const firstPage = buildDebtMenu(debts, 0);
  const secondPage = buildDebtMenu(debts, 99);

  assert.equal(firstPage.replyMarkup?.inline_keyboard.length, 9);
  assert.equal(secondPage.page, 1);
  assert.match(secondPage.text, /9 people/);
  assert.ok(
    (firstPage.replyMarkup?.inline_keyboard ?? [])
      .flat()
      .every(
        (button) =>
          Buffer.byteLength(button.callback_data, "utf8") <= 64,
      ),
  );
});

test("parses only valid debt-menu callbacks", () => {
  assert.deepEqual(parseDebtCallbackData("debts:page:2"), {
    kind: "PAGE",
    page: 2,
  });
  assert.deepEqual(parseDebtCallbackData("debts:person:42:1"), {
    kind: "PERSON",
    recordId: "42",
    returnPage: 1,
  });
  assert.deepEqual(parseDebtCallbackData("debts:noop"), {
    kind: "NOOP",
  });
  assert.equal(parseDebtCallbackData("debts:person:42:-1"), null);
  assert.equal(parseDebtCallbackData("other:page:1"), null);
});

test("builds a back button for a detail view", () => {
  assert.deepEqual(buildDebtBackButton(3), {
    inline_keyboard: [
      [
        {
          text: "⬅️ Back to all debts",
          callback_data: "debts:page:3",
        },
      ],
    ],
  });
});

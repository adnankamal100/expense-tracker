import {
  getOutstandingDebtPeople,
  type DebtRecord,
} from "./debt-summary.ts";

const PEOPLE_PER_PAGE = 8;
const MAX_CALLBACK_ID_LENGTH = 40;

export type TelegramInlineKeyboardMarkup = {
  inline_keyboard: Array<
    Array<{
      callback_data: string;
      text: string;
    }>
  >;
};

export type DebtMenuView = {
  page: number;
  replyMarkup?: TelegramInlineKeyboardMarkup;
  text: string;
};

export type DebtCallbackAction =
  | { kind: "NOOP" }
  | { kind: "PAGE"; page: number }
  | {
      kind: "PERSON";
      recordId: string;
      returnPage: number;
    };

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function truncateButtonName(name: string): string {
  const characters = Array.from(name.trim());

  return characters.length <= 28
    ? characters.join("")
    : `${characters.slice(0, 27).join("")}…`;
}

function getSafeCallbackId(id: number | string | null): string | null {
  if (id === null) {
    return null;
  }

  const value = String(id);

  return new RegExp(
    `^[A-Za-z0-9_-]{1,${MAX_CALLBACK_ID_LENGTH}}$`,
  ).test(value)
    ? value
    : null;
}

export function buildDebtMenu(
  debts: DebtRecord[],
  requestedPage = 0,
): DebtMenuView {
  const people = getOutstandingDebtPeople(debts)
    .filter(
      (person) => getSafeCallbackId(person.representativeId) !== null,
    )
    .sort((first, second) =>
      first.personName.localeCompare(second.personName, "en-IN", {
        sensitivity: "base",
      }),
    );

  if (people.length === 0) {
    return {
      page: 0,
      text: "🤝 Outstanding debts\n\nNo outstanding borrowed or lent balances.",
    };
  }

  const pageCount = Math.ceil(people.length / PEOPLE_PER_PAGE);
  const page = Math.min(
    Math.max(Math.trunc(requestedPage), 0),
    pageCount - 1,
  );
  const visiblePeople = people.slice(
    page * PEOPLE_PER_PAGE,
    (page + 1) * PEOPLE_PER_PAGE,
  );
  const inlineKeyboard = visiblePeople.map((person) => {
    const recordId = getSafeCallbackId(person.representativeId);
    const relationship =
      person.netAmount > 0
        ? `owes you ${formatCurrency(person.netAmount)}`
        : `you owe ${formatCurrency(Math.abs(person.netAmount))}`;

    return [
      {
        text: `${truncateButtonName(person.personName)} — ${relationship}`,
        callback_data: `debts:person:${recordId}:${page}`,
      },
    ];
  });

  if (pageCount > 1) {
    inlineKeyboard.push([
      ...(page > 0
        ? [
            {
              text: "⬅️ Previous",
              callback_data: `debts:page:${page - 1}`,
            },
          ]
        : []),
      {
        text: `${page + 1}/${pageCount}`,
        callback_data: "debts:noop",
      },
      ...(page < pageCount - 1
        ? [
            {
              text: "Next ➡️",
              callback_data: `debts:page:${page + 1}`,
            },
          ]
        : []),
    ]);
  }

  return {
    page,
    text: [
      "🤝 Outstanding debts",
      "",
      "Tap a person to see the total and every open entry.",
      `${people.length} ${people.length === 1 ? "person" : "people"} with an outstanding balance.`,
    ].join("\n"),
    replyMarkup: { inline_keyboard: inlineKeyboard },
  };
}

export function buildDebtBackButton(
  returnPage: number,
): TelegramInlineKeyboardMarkup {
  const safePage = Math.max(0, Math.trunc(returnPage));

  return {
    inline_keyboard: [
      [
        {
          text: "⬅️ Back to all debts",
          callback_data: `debts:page:${safePage}`,
        },
      ],
    ],
  };
}

export function parseDebtCallbackData(
  data: string,
): DebtCallbackAction | null {
  if (data === "debts:noop") {
    return { kind: "NOOP" };
  }

  const pageMatch = data.match(/^debts:page:(\d{1,6})$/);

  if (pageMatch) {
    return { kind: "PAGE", page: Number(pageMatch[1]) };
  }

  const personMatch = data.match(
    new RegExp(
      `^debts:person:([A-Za-z0-9_-]{1,${MAX_CALLBACK_ID_LENGTH}}):(\\d{1,6})$`,
    ),
  );

  if (personMatch) {
    return {
      kind: "PERSON",
      recordId: personMatch[1],
      returnPage: Number(personMatch[2]),
    };
  }

  return null;
}

import { createClient } from "@supabase/supabase-js";

type TelegramUpdate = {
  update_id: number;
  message?: {
    text?: string;
    chat: {
      id: number;
    };
    from?: {
      id: number;
    };
  };
};

type Expense = {
  id: number;
  amount: number | string;
  description: string;
  category: string;
  expense_date: string;
};

type DebtType = "LENT" | "BORROWED";

type Debt = {
  amount: number | string;
  person_name: string;
  record_type: DebtType;
  status: "OPEN" | "SETTLED";
};

type ParsedDebt = {
  amount: number;
  personName: string;
  recordType: DebtType;
  moneyDate: string;
};

const amountPattern = "([0-9][0-9,]*(?:\\.[0-9]{1,2})?)";
const currencyBeforePattern = "(?:₹\\s*|rs\\.?\\s*|inr\\s*)?";
const currencyAfterPattern = "(?:\\s*(?:rs\\.?|inr|rupees?))?";

const debtPatterns: Array<{
  pattern: RegExp;
  recordType: DebtType;
  amountGroup: number;
  personGroup: number;
  dateGroup: number;
}> = [
  {
    pattern: new RegExp(
      `^i\\s+(?:borrowed|borrow)\\s+(?:money\\s+)?${currencyBeforePattern}${amountPattern}${currencyAfterPattern}\\s+from\\s+(.+?)(?:\\s+on\\s+(.+))?$`,
      "i",
    ),
    recordType: "BORROWED",
    amountGroup: 1,
    personGroup: 2,
    dateGroup: 3,
  },
  {
    pattern: new RegExp(
      `^i\\s+(?:lent|leant|lend)\\s+(?:money\\s+)?${currencyBeforePattern}${amountPattern}${currencyAfterPattern}\\s+to\\s+(.+?)(?:\\s+on\\s+(.+))?$`,
      "i",
    ),
    recordType: "LENT",
    amountGroup: 1,
    personGroup: 2,
    dateGroup: 3,
  },
  {
    pattern: new RegExp(
      `^(.+?)\\s+borrowed\\s+(?:money\\s+)?${currencyBeforePattern}${amountPattern}${currencyAfterPattern}\\s+from\\s+me(?:\\s+on\\s+(.+))?$`,
      "i",
    ),
    recordType: "LENT",
    amountGroup: 2,
    personGroup: 1,
    dateGroup: 3,
  },
  {
    pattern: new RegExp(
      `^(?:borrowed|borrow)\\s+${currencyBeforePattern}${amountPattern}${currencyAfterPattern}\\s+(?:from\\s+)?(.+?)(?:\\s+on\\s+(.+))?$`,
      "i",
    ),
    recordType: "BORROWED",
    amountGroup: 1,
    personGroup: 2,
    dateGroup: 3,
  },
  {
    pattern: new RegExp(
      `^(?:lent|leant|lend)\\s+${currencyBeforePattern}${amountPattern}${currencyAfterPattern}\\s+(?:to\\s+)?(.+?)(?:\\s+on\\s+(.+))?$`,
      "i",
    ),
    recordType: "LENT",
    amountGroup: 1,
    personGroup: 2,
    dateGroup: 3,
  },
];

const monthNumbers: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(supabaseUrl, supabaseKey);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function detectCategory(description: string): string {
  const text = description.toLowerCase();

  const categories: Record<string, string[]> = {
    Food: [
      "food",
      "rice",
      "coffee",
      "tea",
      "restaurant",
      "lunch",
      "dinner",
      "breakfast",
    ],
    Transport: [
      "auto",
      "uber",
      "bus",
      "train",
      "petrol",
      "fuel",
      "taxi",
    ],
    Bills: [
      "electricity",
      "internet",
      "recharge",
      "rent",
      "bill",
    ],
    Shopping: [
      "shirt",
      "shoes",
      "amazon",
      "shopping",
      "clothes",
    ],
    Entertainment: [
      "movie",
      "netflix",
      "game",
      "concert",
    ],
    Health: [
      "medicine",
      "doctor",
      "hospital",
      "pharmacy",
    ],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return category;
    }
  }

  return "Other";
}

function parseExpense(text: string) {
  const match = text
    .trim()
    .match(/^₹?\s*(\d+(?:\.\d{1,2})?)\s+(?:for\s+)?(.+)$/i);

  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const description = match[2].trim();

  if (!Number.isFinite(amount) || amount <= 0 || !description) {
    return null;
  }

  return {
    amount,
    description,
    category: detectCategory(description),
  };
}

function formatDateParts(year: number, month: number, day: number) {
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseMoneyDate(value?: string): string | null {
  if (!value) {
    return getToday();
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/(\d+)(?:st|nd|rd|th)\b/g, "$1")
    .replace(/\s+/g, " ");

  if (normalized === "today") {
    return getToday();
  }

  if (normalized === "yesterday") {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return yesterday.toISOString().slice(0, 10);
  }

  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (isoMatch) {
    return formatDateParts(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
    );
  }

  const numericMatch = normalized.match(
    /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/,
  );

  if (numericMatch) {
    return formatDateParts(
      numericMatch[3]
        ? Number(numericMatch[3])
        : new Date().getUTCFullYear(),
      Number(numericMatch[2]),
      Number(numericMatch[1]),
    );
  }

  const words = normalized.split(" ");
  const monthIndex = words.findIndex((word) => monthNumbers[word]);

  if (monthIndex === -1) {
    return null;
  }

  const month = monthNumbers[words[monthIndex]];
  const dayWord = words[monthIndex - 1] ?? words[monthIndex + 1];
  const yearWord = words.find((word, index) => {
    return index !== monthIndex && /^\d{4}$/.test(word);
  });
  const day = Number(dayWord);
  const year = yearWord
    ? Number(yearWord)
    : new Date().getUTCFullYear();

  if (!Number.isInteger(day)) {
    return null;
  }

  return formatDateParts(year, month, day);
}

function parseDebt(text: string): ParsedDebt | null {
  const trimmedText = text.trim();
  const normalizedText = /\s+on\s+(?:today|yesterday)$/i.test(
    trimmedText,
  )
    ? trimmedText
    : trimmedText.replace(/\s+(today|yesterday)$/i, " on $1");

  for (const debtPattern of debtPatterns) {
    const match = normalizedText.match(debtPattern.pattern);

    if (!match) {
      continue;
    }

    const amount = Number(
      match[debtPattern.amountGroup].replace(/,/g, ""),
    );
    const personName = match[debtPattern.personGroup]
      .trim()
      .replace(/\s+/g, " ");
    const moneyDate = parseMoneyDate(match[debtPattern.dateGroup]);

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !personName ||
      !moneyDate
    ) {
      return null;
    }

    return {
      amount,
      personName,
      recordType: debtPattern.recordType,
      moneyDate,
    };
  }

  return null;
}

function isDebtIntent(text: string): boolean {
  return /\b(?:borrowed|borrow|lent|leant|lend|loaned)\b/i.test(text);
}

function normalizePersonName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN");
}

function formatMoneyDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function getPersonBalance(debts: Debt[], personName: string): number {
  const normalizedName = normalizePersonName(personName);

  return debts
    .filter(
      (debt) => normalizePersonName(debt.person_name) === normalizedName,
    )
    .reduce(
      (balance, debt) =>
        balance +
        (debt.record_type === "LENT"
          ? Number(debt.amount)
          : -Number(debt.amount)),
      0,
    );
}

function buildDebtSummary(debts: Debt[]): string {
  const balances = new Map<
    string,
    { personName: string; netAmount: number }
  >();

  for (const debt of debts) {
    const key = normalizePersonName(debt.person_name);
    const balance = balances.get(key) ?? {
      personName: debt.person_name,
      netAmount: 0,
    };

    balance.netAmount +=
      debt.record_type === "LENT"
        ? Number(debt.amount)
        : -Number(debt.amount);
    balances.set(key, balance);
  }

  const outstanding = Array.from(balances.values())
    .filter((balance) => Math.abs(balance.netAmount) >= 0.005)
    .sort(
      (first, second) =>
        Math.abs(second.netAmount) - Math.abs(first.netAmount),
    );

  if (outstanding.length === 0) {
    return "No outstanding borrowed or lent balances.";
  }

  return outstanding
    .map((balance) => {
      return balance.netAmount > 0
        ? `${balance.personName} owes you ${formatCurrency(balance.netAmount)}`
        : `You owe ${balance.personName} ${formatCurrency(Math.abs(balance.netAmount))}`;
    })
    .join("\n");
}

async function sendTelegramMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing.");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    },
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      `Telegram reply failed: ${result.description ?? "Unknown error"}`,
    );
  }
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getFirstDayOfMonth(): string {
  const now = new Date();

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);
}

function buildExpenseSummary(expenses: Expense[]): string {
  if (expenses.length === 0) {
    return "No expenses found.";
  }

  const total = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0,
  );

  const categoryTotals = expenses.reduce<Record<string, number>>(
    (totals, expense) => {
      totals[expense.category] =
        (totals[expense.category] ?? 0) +
        Number(expense.amount);

      return totals;
    },
    {},
  );

  const categoryLines = Object.entries(categoryTotals)
    .sort(([, first], [, second]) => second - first)
    .map(
      ([category, amount]) =>
        `${category}: ${formatCurrency(amount)}`,
    )
    .join("\n");

  return `Total: ${formatCurrency(total)}\n\n${categoryLines}`;
}

async function handleCommand(
  command: string,
  chatId: number,
  telegramUserId: number,
) {
  const supabase = getSupabaseClient();

  if (command === "/start" || command === "/help") {
    await sendTelegramMessage(
      chatId,
      [
        "💰 Expense Tracker",
        "",
        "Add an expense:",
        "100 for fried rice",
        "",
        "Track borrowed or lent money:",
        "borrowed 500 Rahul",
        "lent 700 Bhavya",
        "I borrowed 1000rs from Bhavya",
        "I lent 500rs to Bhavya on 13th July",
        "Bhavya borrowed 500rs from me",
        "",
        "Available commands:",
        "/today — today's spending",
        "/month — this month's spending",
        "/recent — latest expenses",
        "/debts — outstanding balances",
        "/help — show this message",
      ].join("\n"),
    );

    return;
  }

  if (command === "/today") {
    const { data, error } = await supabase
      .from("expenses")
      .select("id, amount, description, category, expense_date")
      .eq("telegram_user_id", telegramUserId)
      .eq("expense_date", getToday());

    if (error) {
      throw error;
    }

    const summary = buildExpenseSummary((data ?? []) as Expense[]);

    await sendTelegramMessage(
      chatId,
      `📅 Today's spending\n\n${summary}`,
    );

    return;
  }

  if (command === "/month") {
    const { data, error } = await supabase
      .from("expenses")
      .select("id, amount, description, category, expense_date")
      .eq("telegram_user_id", telegramUserId)
      .gte("expense_date", getFirstDayOfMonth());

    if (error) {
      throw error;
    }

    const summary = buildExpenseSummary((data ?? []) as Expense[]);

    await sendTelegramMessage(
      chatId,
      `📊 This month's spending\n\n${summary}`,
    );

    return;
  }

  if (command === "/recent") {
    const { data, error } = await supabase
      .from("expenses")
      .select("id, amount, description, category, expense_date")
      .eq("telegram_user_id", telegramUserId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      throw error;
    }

    const expenses = (data ?? []) as Expense[];

    if (expenses.length === 0) {
      await sendTelegramMessage(chatId, "No expenses found.");
      return;
    }

    const lines = expenses.map(
      (expense) =>
        `${formatCurrency(Number(expense.amount))} — ${
          expense.description
        } (${expense.category})`,
    );

    await sendTelegramMessage(
      chatId,
      `🕘 Recent expenses\n\n${lines.join("\n")}`,
    );

    return;
  }

  if (command === "/debts") {
    const { data, error } = await supabase
      .from("debts")
      .select("amount, person_name, record_type, status")
      .eq("status", "OPEN");

    if (error) {
      throw error;
    }

    await sendTelegramMessage(
      chatId,
      `🤝 Outstanding balances\n\n${buildDebtSummary((data ?? []) as Debt[])}`,
    );

    return;
  }

  await sendTelegramMessage(
    chatId,
    "Unknown command. Send /help to see available commands.",
  );
}

export async function POST(request: Request) {
  try {
    const update = (await request.json()) as TelegramUpdate;
    const message = update.message;

    if (!message?.text || !message.from?.id) {
      return Response.json({ ok: true });
    }

    const text = message.text.trim();
    const chatId = message.chat.id;
    const telegramUserId = message.from.id;

    if (text.startsWith("/")) {
      const command = text.split(" ")[0].toLowerCase();

      await handleCommand(command, chatId, telegramUserId);

      return Response.json({ ok: true });
    }

    const parsedDebt = parseDebt(text);

    if (parsedDebt) {
      const supabase = getSupabaseClient();

      const { error } = await supabase.from("debts").insert({
        record_type: parsedDebt.recordType,
        person_name: parsedDebt.personName,
        amount: parsedDebt.amount,
        due_date: parsedDebt.moneyDate,
        status: "OPEN",
      });

      if (error) {
        throw error;
      }

      const { data: openDebts, error: balanceError } = await supabase
        .from("debts")
        .select("amount, person_name, record_type, status")
        .eq("status", "OPEN");

      if (balanceError) {
        console.error(
          "Could not calculate Telegram debt balance:",
          balanceError,
        );
      }

      const balance = balanceError
        ? null
        : getPersonBalance(
            (openDebts ?? []) as Debt[],
            parsedDebt.personName,
          );

      let balanceLine = "Balance saved to the dashboard.";

      if (balance !== null) {
        if (balance > 0.005) {
          balanceLine = `${parsedDebt.personName} now owes you ${formatCurrency(balance)}.`;
        } else if (balance < -0.005) {
          balanceLine = `You now owe ${parsedDebt.personName} ${formatCurrency(Math.abs(balance))}.`;
        } else {
          balanceLine = `Your balance with ${parsedDebt.personName} is fully settled.`;
        }
      }

      await sendTelegramMessage(
        chatId,
        [
          "✅ Money entry added",
          "",
          parsedDebt.recordType === "LENT"
            ? `${parsedDebt.personName} borrowed ${formatCurrency(parsedDebt.amount)} from you.`
            : `You borrowed ${formatCurrency(parsedDebt.amount)} from ${parsedDebt.personName}.`,
          `Date: ${formatMoneyDate(parsedDebt.moneyDate)}`,
          "",
          balanceLine,
        ].join("\n"),
      );

      return Response.json({ ok: true });
    }

    if (isDebtIntent(text)) {
      await sendTelegramMessage(
        chatId,
        [
          "Please include the amount, person and direction.",
          "",
          "Examples:",
          "borrowed 500 Rahul",
          "lent 700 Bhavya",
          "I borrowed 1000rs from Bhavya",
          "I lent 500rs to Bhavya on 13th July",
          "Bhavya borrowed 500rs from me",
        ].join("\n"),
      );

      return Response.json({ ok: true });
    }

    const parsedExpense = parseExpense(text);

    if (!parsedExpense) {
      await sendTelegramMessage(
        chatId,
        "Please send an expense like: 100 for fried rice\n\nSend /help for commands.",
      );

      return Response.json({ ok: true });
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase.from("expenses").insert({
      amount: parsedExpense.amount,
      description: parsedExpense.description,
      category: parsedExpense.category,
      source: "telegram",
      telegram_user_id: telegramUserId,
      telegram_update_id: update.update_id,
    });

    if (error?.code === "23505") {
      console.log(
        `Duplicate Telegram update ignored: ${update.update_id}`,
      );

      return Response.json({
        ok: true,
        duplicate: true,
      });
    }

    if (error) {
      throw error;
    }

    await sendTelegramMessage(
      chatId,
      [
        "✅ Expense added",
        "",
        `${formatCurrency(parsedExpense.amount)} — ${
          parsedExpense.description
        }`,
        `Category: ${parsedExpense.category}`,
      ].join("\n"),
    );

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);

    return Response.json(
      {
        ok: false,
        error: "Webhook processing failed.",
      },
      { status: 500 },
    );
  }
}

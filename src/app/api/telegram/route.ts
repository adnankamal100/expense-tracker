import { createClient } from "@supabase/supabase-js";
import {
  isDebtIntent,
  normalizePersonName,
  parseDebtInput,
  type DebtParseFailureReason,
  type DebtType,
} from "@/lib/telegram-debt-parser";

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

type Debt = {
  amount: number | string;
  person_name: string;
  record_type: DebtType;
  status: "OPEN" | "SETTLED";
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

function formatMoneyDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function buildDebtInputError(reason: DebtParseFailureReason): string {
  const guidance: Record<DebtParseFailureReason, string> = {
    not_debt: "I could not understand that message.",
    missing_amount:
      "Please include the amount, such as: borrowed 500 Rahul",
    missing_person:
      "Please include the person's name, such as: lent 700 Bhavya",
    invalid_amount:
      "Use a positive amount with up to two decimal places, such as ₹1,250.50.",
    invalid_date:
      "I could not understand that date. Try today, yesterday, 13th July, 13/07/2026, or 2026-07-13.",
    unrecognized_format:
      "I recognized this as borrowed/lent money, but not the sentence format.",
  };

  return [
    guidance[reason],
    "",
    "Examples:",
    "borrowed 500 Rahul",
    "lent 700 Bhavya",
    "I owe Rahul 500",
    "Bhavya owes me 700",
    "I borrowed ₹1,000 from Rahul yesterday",
    "I lent 500 to Bhavya on 13th July",
  ].join("\n");
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
        "I owe Rahul 1.5k",
        "Bhavya owes me 700",
        "I lent 500rs to Bhavya for lunch yesterday",
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
      const command = text
        .split(/\s+/)[0]
        .split("@")[0]
        .toLowerCase();

      await handleCommand(command, chatId, telegramUserId);

      return Response.json({ ok: true });
    }

    const debtResult = parseDebtInput(text);

    if (debtResult.ok) {
      const parsedDebt = debtResult.value;
      const supabase = getSupabaseClient();

      const { error } = await supabase.from("debts").insert({
        record_type: parsedDebt.recordType,
        person_name: parsedDebt.personName,
        amount: parsedDebt.amount,
        description: parsedDebt.description,
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
          ...(parsedDebt.description
            ? [`Note: ${parsedDebt.description}`]
            : []),
          "",
          balanceLine,
        ].join("\n"),
      );

      return Response.json({ ok: true });
    }

    if (isDebtIntent(text)) {
      await sendTelegramMessage(
        chatId,
        buildDebtInputError(debtResult.reason),
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

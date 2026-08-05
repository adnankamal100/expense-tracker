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
        "Available commands:",
        "/today — today's spending",
        "/month — this month's spending",
        "/recent — latest expenses",
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
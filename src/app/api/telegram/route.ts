import { createClient } from "@supabase/supabase-js";
import {
  isDebtIntent,
  parseDebtInput,
  parseDebtQuery,
  type DebtParseFailureReason,
} from "@/lib/telegram-debt-parser";
import {
  buildPersonDebtBreakdown,
  getPersonBalance,
  type DebtRecord,
} from "@/lib/debt-summary";
import {
  buildDebtBackButton,
  buildDebtMenu,
  parseDebtCallbackData,
  type TelegramInlineKeyboardMarkup,
} from "@/lib/telegram-debt-menu";
import {
  buildSpendingMenu,
  getSpendingDateRange,
  parseSpendingCallbackData,
  type SpendingPeriod,
} from "@/lib/telegram-spending-menu";

type TelegramMessage = {
  message_id?: number;
  text?: string;
  chat: {
    id: number;
  };
  from?: {
    id: number;
  };
};

type TelegramUpdate = {
  callback_query?: {
    data?: string;
    from: {
      id: number;
    };
    id: string;
    message?: TelegramMessage;
  };
  update_id: number;
  message?: TelegramMessage;
};

type TelegramCallbackQuery = NonNullable<
  TelegramUpdate["callback_query"]
>;

type Expense = {
  id: number;
  amount: number | string;
  description: string;
  category: string;
  expense_date: string;
};

type Debt = DebtRecord;

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

async function callTelegramApi(
  method: string,
  payload: Record<string, unknown>,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing.");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      `Telegram ${method} failed: ${result.description ?? "Unknown error"}`,
    );
  }
}

async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyMarkup?: TelegramInlineKeyboardMarkup,
) {
  await callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

async function editTelegramMessage(
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: TelegramInlineKeyboardMarkup,
) {
  await callTelegramApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string,
) {
  await callTelegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

async function safelyAnswerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string,
) {
  try {
    await answerTelegramCallbackQuery(callbackQueryId, text);
  } catch (error) {
    console.error("Could not acknowledge Telegram button:", error);
  }
}

async function getSpendingMenuView(
  telegramUserId: number,
  period: SpendingPeriod,
) {
  const now = new Date();
  const range = getSpendingDateRange(period, now);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("id, amount, description, category, expense_date")
    .eq("telegram_user_id", telegramUserId)
    .gte("expense_date", range.startDate)
    .lte("expense_date", range.endDate);

  if (error) {
    throw error;
  }

  return buildSpendingMenu((data ?? []) as Expense[], period, now);
}

async function handleSpendingCallback(
  callbackQuery: TelegramCallbackQuery,
  period: SpendingPeriod,
) {
  await safelyAnswerTelegramCallbackQuery(callbackQuery.id);

  const message = callbackQuery.message;

  if (!message?.message_id) {
    return;
  }

  const menu = await getSpendingMenuView(
    callbackQuery.from.id,
    period,
  );

  await editTelegramMessage(
    message.chat.id,
    message.message_id,
    menu.text,
    menu.replyMarkup,
  );
}

async function fetchOpenDebts(): Promise<Debt[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("debts")
    .select(
      "id, amount, person_name, record_type, status, due_date, description, created_at",
    )
    .eq("status", "OPEN");

  if (error) {
    throw error;
  }

  return (data ?? []) as Debt[];
}

async function handleDebtCallback(
  callbackQuery: TelegramCallbackQuery,
) {
  const action = callbackQuery.data
    ? parseDebtCallbackData(callbackQuery.data)
    : null;

  if (!action) {
    await safelyAnswerTelegramCallbackQuery(
      callbackQuery.id,
      "This debt button is no longer available.",
    );
    return;
  }

  await safelyAnswerTelegramCallbackQuery(callbackQuery.id);

  if (action.kind === "NOOP") {
    return;
  }

  const message = callbackQuery.message;

  if (!message?.message_id) {
    return;
  }

  const debts = await fetchOpenDebts();

  if (action.kind === "PAGE") {
    const menu = buildDebtMenu(debts, action.page);

    await editTelegramMessage(
      message.chat.id,
      message.message_id,
      menu.text,
      menu.replyMarkup,
    );
    return;
  }

  const representativeDebt = debts.find(
    (debt) => String(debt.id) === action.recordId,
  );
  const backButton = buildDebtBackButton(action.returnPage);

  if (!representativeDebt) {
    await editTelegramMessage(
      message.chat.id,
      message.message_id,
      [
        "This balance has changed since the list was opened.",
        "Tap Back to refresh your outstanding debts.",
      ].join("\n\n"),
      backButton,
    );
    return;
  }

  await editTelegramMessage(
    message.chat.id,
    message.message_id,
    buildPersonDebtBreakdown(
      debts,
      representativeDebt.person_name,
      "BALANCE",
    ),
    backButton,
  );
}

async function handleCommand(
  command: string,
  commandArguments: string,
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
        "/spending — choose Today, Week, or Month",
        "/today — today's category overview",
        "/week — this week's category overview",
        "/month — this month's category overview",
        "/recent — latest expenses",
        "/debts — tap a person to view outstanding balances",
        "/debts Bhavya — total and individual entries",
        "/help — show this message",
      ].join("\n"),
    );

    return;
  }

  const commandPeriods: Partial<Record<string, SpendingPeriod>> = {
    "/today": "today",
    "/week": "week",
    "/month": "month",
  };
  let spendingPeriod = commandPeriods[command];

  if (command === "/spending") {
    const requestedPeriod = commandArguments.toLowerCase();

    if (
      requestedPeriod &&
      !["today", "week", "month"].includes(requestedPeriod)
    ) {
      await sendTelegramMessage(
        chatId,
        "Use /spending, /spending today, /spending week, or /spending month.",
      );
      return;
    }

    spendingPeriod =
      (requestedPeriod as SpendingPeriod | "") || "month";
  }

  if (spendingPeriod) {
    const menu = await getSpendingMenuView(
      telegramUserId,
      spendingPeriod,
    );

    await sendTelegramMessage(
      chatId,
      menu.text,
      menu.replyMarkup,
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
    const debts = await fetchOpenDebts();

    if (commandArguments) {
      await sendTelegramMessage(
        chatId,
        buildPersonDebtBreakdown(
          debts,
          commandArguments,
          "BALANCE",
        ),
        buildDebtBackButton(0),
      );
      return;
    }

    const menu = buildDebtMenu(debts);

    await sendTelegramMessage(
      chatId,
      menu.text,
      menu.replyMarkup,
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
    const callbackQuery = update.callback_query;

    if (callbackQuery) {
      const spendingPeriod = parseSpendingCallbackData(
        callbackQuery.data ?? "",
      );

      if (spendingPeriod) {
        await handleSpendingCallback(callbackQuery, spendingPeriod);
      } else {
        await handleDebtCallback(callbackQuery);
      }

      return Response.json({ ok: true });
    }

    const message = update.message;

    if (!message?.text || !message.from?.id) {
      return Response.json({ ok: true });
    }

    const text = message.text.trim();
    const chatId = message.chat.id;
    const telegramUserId = message.from.id;

    if (text.startsWith("/")) {
      const [rawCommand, ...argumentParts] = text.split(/\s+/);
      const command = rawCommand.split("@")[0].toLowerCase();
      const commandArguments = argumentParts.join(" ").trim();

      await handleCommand(
        command,
        commandArguments,
        chatId,
        telegramUserId,
      );

      return Response.json({ ok: true });
    }

    const debtQuery = parseDebtQuery(text);

    if (debtQuery) {
      const debts = await fetchOpenDebts();

      await sendTelegramMessage(
        chatId,
        buildPersonDebtBreakdown(
          debts,
          debtQuery.personName,
          debtQuery.kind,
        ),
      );

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
      expense_date: getSpendingDateRange("today").endDate,
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

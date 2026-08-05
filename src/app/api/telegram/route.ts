import { createClient } from "@supabase/supabase-js";

type TelegramUpdate = {
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
  const match = text.trim().match(/^₹?\s*(\d+(?:\.\d{1,2})?)\s+(?:for\s+)?(.+)$/i);

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
    throw new Error("Telegram bot token is missing.");
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}

export async function POST(request: Request) {
  try {
    const update = (await request.json()) as TelegramUpdate;
    const message = update.message;

    if (!message?.text) {
      return Response.json({ ok: true });
    }

    const parsedExpense = parseExpense(message.text);

    if (!parsedExpense) {
      await sendTelegramMessage(
        message.chat.id,
        "Please send an expense like: 100 for fried rice",
      );

      return Response.json({ ok: true });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase environment variables are missing.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.from("expenses").insert({
      amount: parsedExpense.amount,
      description: parsedExpense.description,
      category: parsedExpense.category,
      source: "telegram",
      telegram_user_id: message.from?.id ?? null,
    });

    if (error) {
      throw error;
    }

    await sendTelegramMessage(
      message.chat.id,
      `✅ Expense added\n\n₹${parsedExpense.amount} — ${parsedExpense.description}\nCategory: ${parsedExpense.category}`,
    );

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);

    return Response.json(
      { ok: false, error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { detectExpenseCategory } from "@/lib/expense-categories";
import { getSpendingDateRange } from "@/lib/telegram-spending-menu";
import {
  parseWebLinkCookie,
  WEB_LINK_COOKIE,
} from "@/lib/web-link-auth";

type AddExpenseRequest = {
  amount?: unknown;
  description?: unknown;
};

async function getTelegramUserId(): Promise<number | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return null;
  }

  const cookieStore = await cookies();
  return parseWebLinkCookie(
    cookieStore.get(WEB_LINK_COOKIE)?.value,
    botToken,
  );
}

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

async function sendWebExpenseConfirmation(
  telegramUserId: number,
  amount: number,
  description: string,
  category: string,
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramUserId,
          text: [
            "✅ Web expense added",
            "",
            `${formatCurrency(amount)} — ${description}`,
            `Category: ${category}`,
          ].join("\n"),
        }),
      },
    );

    if (!response.ok) {
      console.error(
        "Could not send web expense confirmation:",
        response.status,
      );
    }
  } catch (error) {
    console.error("Could not send web expense confirmation:", error);
  }
}

export async function GET() {
  const telegramUserId = await getTelegramUserId();

  return Response.json(
    { connected: telegramUserId !== null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin
    ) {
      return Response.json(
        { ok: false, error: "Invalid request origin." },
        { status: 403 },
      );
    }

    const telegramUserId = await getTelegramUserId();

    if (telegramUserId === null) {
      return Response.json(
        {
          ok: false,
          code: "web_link_required",
          error: "Connect this browser from Telegram first.",
        },
        { status: 401 },
      );
    }

    const contentLength = Number(
      request.headers.get("content-length") ?? "0",
    );

    if (contentLength > 5000) {
      return Response.json(
        { ok: false, error: "Request is too large." },
        { status: 413 },
      );
    }

    const body = (await request.json()) as AddExpenseRequest;
    const amount = Number(body.amount);
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 999999999 ||
      !description ||
      description.length > 200
    ) {
      return Response.json(
        { ok: false, error: "Enter a valid amount and description." },
        { status: 400 },
      );
    }

    const category = detectExpenseCategory(description);
    const expenseDate = getSpendingDateRange(
      "today",
    ).endDate;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        amount,
        category,
        description,
        expense_date: expenseDate,
        source: "web",
        telegram_user_id: telegramUserId,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    await sendWebExpenseConfirmation(
      telegramUserId,
      amount,
      description,
      category,
    );

    return Response.json(
      { ok: true, expense: data },
      { status: 201 },
    );
  } catch (error) {
    console.error("Web expense API error:", error);

    return Response.json(
      { ok: false, error: "Could not save this expense." },
      { status: 500 },
    );
  }
}

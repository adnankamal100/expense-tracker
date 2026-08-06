import { createClient } from "@supabase/supabase-js";
import { parseHdfcSms } from "@/lib/hdfc-sms-parser";
import { verifyIphoneImportToken } from "@/lib/iphone-import-auth";

type ImportRequest = {
  sms?: unknown;
  telegramUserId?: unknown;
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

function getBearerToken(request: Request): string {
  return request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    .trim() ?? "";
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

async function sendImportConfirmation(
  telegramUserId: number,
  amount: number,
  payee: string,
  category: string,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramUserId,
          text: [
            "✅ UPI expense imported",
            "",
            `${formatCurrency(amount)} — ${payee}`,
            `Category: ${category}`,
          ].join("\n"),
        }),
      },
    );

    if (!response.ok) {
      console.error(
        "Could not send iPhone import confirmation:",
        response.status,
      );
    }
  } catch (error) {
    console.error("Could not send iPhone import confirmation:", error);
  }
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(
      request.headers.get("content-length") ?? "0",
    );

    if (contentLength > 10000) {
      return Response.json(
        { ok: false, error: "Request is too large." },
        { status: 413 },
      );
    }

    const body = (await request.json()) as ImportRequest;
    const telegramUserId = Number(body.telegramUserId);
    const sms = typeof body.sms === "string" ? body.sms.trim() : "";
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (
      !Number.isSafeInteger(telegramUserId) ||
      telegramUserId <= 0 ||
      !botToken ||
      !verifyIphoneImportToken(
        getBearerToken(request),
        botToken,
        telegramUserId,
      )
    ) {
      return Response.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    if (!sms || sms.length > 4000) {
      return Response.json(
        { ok: false, error: "Provide one HDFC SMS message." },
        { status: 400 },
      );
    }

    const parsed = parseHdfcSms(sms);

    if (!parsed.ok) {
      if (parsed.ignored) {
        return Response.json({
          ok: true,
          imported: false,
          ignored: parsed.reason,
        });
      }

      return Response.json(
        {
          ok: false,
          error: "The outgoing HDFC SMS format was incomplete.",
          reason: parsed.reason,
        },
        { status: 422 },
      );
    }

    const expense = parsed.value;
    const description = `${expense.payee} · HDFC UPI Ref ${expense.reference}`;
    const supabase = getSupabaseClient();
    const { data: existing, error: lookupError } = await supabase
      .from("expenses")
      .select("id")
      .eq("source", "hdfc_sms")
      .eq("telegram_user_id", telegramUserId)
      .eq("description", description)
      .limit(1);

    if (lookupError) {
      throw lookupError;
    }

    if ((existing ?? []).length > 0) {
      return Response.json({
        ok: true,
        imported: false,
        duplicate: true,
      });
    }

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        amount: expense.amount,
        category: expense.category,
        description,
        expense_date: expense.expenseDate,
        source: "hdfc_sms",
        telegram_user_id: telegramUserId,
      })
      .select("id, amount, description, category, expense_date")
      .single();

    if (error) {
      throw error;
    }

    await sendImportConfirmation(
      telegramUserId,
      expense.amount,
      expense.payee,
      expense.category,
    );

    return Response.json({
      ok: true,
      imported: true,
      expense: data,
    });
  } catch (error) {
    console.error("HDFC SMS import error:", error);

    return Response.json(
      { ok: false, error: "Could not import this HDFC SMS." },
      { status: 500 },
    );
  }
}

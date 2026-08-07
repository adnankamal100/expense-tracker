import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  createWebLinkCookieValue,
  verifyWebLinkToken,
  WEB_LINK_COOKIE,
} from "@/lib/web-link-auth";

function redirectToDashboard(request: Request, status: string) {
  const destination = new URL("/", request.url);
  destination.searchParams.set("web_link", status);

  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const telegramUserId = Number(
    requestUrl.searchParams.get("telegramUserId"),
  );
  const providedToken = requestUrl.searchParams.get("token") ?? "";
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (
    !botToken ||
    !Number.isSafeInteger(telegramUserId) ||
    telegramUserId <= 0 ||
    !verifyWebLinkToken(
      providedToken,
      botToken,
      telegramUserId,
    )
  ) {
    return redirectToDashboard(request, "invalid");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return redirectToDashboard(request, "error");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { error } = await supabase
    .from("expenses")
    .update({ telegram_user_id: telegramUserId })
    .eq("source", "web")
    .is("telegram_user_id", null);

  if (error) {
    console.error("Could not link existing web expenses:", error);
    return redirectToDashboard(request, "error");
  }

  const response = redirectToDashboard(request, "connected");
  response.cookies.set({
    name: WEB_LINK_COOKIE,
    value: createWebLinkCookieValue(
      telegramUserId,
      providedToken,
    ),
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

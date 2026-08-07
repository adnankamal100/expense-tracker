import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_CONTEXT = "expense-tracker:web-link:v1";

export const WEB_LINK_COOKIE = "expense_tracker_web_link";

export function createWebLinkToken(
  telegramBotToken: string,
  telegramUserId: number,
): string {
  return createHmac("sha256", telegramBotToken)
    .update(`${TOKEN_CONTEXT}:${telegramUserId}`)
    .digest("hex");
}

export function verifyWebLinkToken(
  providedToken: string,
  telegramBotToken: string,
  telegramUserId: number,
): boolean {
  if (!/^[a-f\d]{64}$/i.test(providedToken)) {
    return false;
  }

  const expectedToken = createWebLinkToken(
    telegramBotToken,
    telegramUserId,
  );

  return timingSafeEqual(
    Buffer.from(providedToken.toLowerCase(), "utf8"),
    Buffer.from(expectedToken, "utf8"),
  );
}

export function createWebLinkCookieValue(
  telegramUserId: number,
  token: string,
): string {
  return `${telegramUserId}.${token}`;
}

export function parseWebLinkCookie(
  value: string | undefined,
  telegramBotToken: string,
): number | null {
  const match = value?.match(/^(\d{1,16})\.([a-f\d]{64})$/i);

  if (!match) {
    return null;
  }

  const telegramUserId = Number(match[1]);

  if (
    !Number.isSafeInteger(telegramUserId) ||
    telegramUserId <= 0 ||
    !verifyWebLinkToken(match[2], telegramBotToken, telegramUserId)
  ) {
    return null;
  }

  return telegramUserId;
}

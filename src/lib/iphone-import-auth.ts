import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_CONTEXT = "expense-tracker:hdfc-sms-import:v1";

export function createIphoneImportToken(
  telegramBotToken: string,
  telegramUserId: number,
): string {
  return createHmac("sha256", telegramBotToken)
    .update(`${TOKEN_CONTEXT}:${telegramUserId}`)
    .digest("hex");
}

export function verifyIphoneImportToken(
  providedToken: string,
  telegramBotToken: string,
  telegramUserId: number,
): boolean {
  if (!/^[a-f\d]{64}$/i.test(providedToken)) {
    return false;
  }

  const expectedToken = createIphoneImportToken(
    telegramBotToken,
    telegramUserId,
  );

  return timingSafeEqual(
    Buffer.from(providedToken.toLowerCase(), "utf8"),
    Buffer.from(expectedToken, "utf8"),
  );
}

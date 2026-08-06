import { detectExpenseCategory } from "./expense-categories.ts";

export type ParsedHdfcExpense = {
  accountSuffix: string;
  amount: number;
  category: string;
  expenseDate: string;
  payee: string;
  reference: string;
};

export type HdfcSmsParseResult =
  | { ok: true; value: ParsedHdfcExpense }
  | {
      ignored: boolean;
      ok: false;
      reason:
        | "credit"
        | "invalid_amount"
        | "invalid_date"
        | "missing_account"
        | "missing_payee"
        | "missing_reference"
        | "not_hdfc_outgoing";
    };

function parseHdfcDate(value: string): string | null {
  const match = value.match(/^(\d{2})[/-](\d{2})[/-](\d{2}|\d{4})$/);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const shortYear = Number(match[3]);
  const year =
    match[3].length === 4
      ? shortYear
      : shortYear >= 70
        ? 1900 + shortYear
        : 2000 + shortYear;
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

export function parseHdfcSms(sms: string): HdfcSmsParseResult {
  const lines = sms
    .normalize("NFKC")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  const normalizedText = lines.join("\n");
  const collapsedText = lines.join(" ");

  if (/\bcredited\b/i.test(normalizedText)) {
    return { ok: false, ignored: true, reason: "credit" };
  }

  const amountMatch = collapsedText.match(
    /^Sent\s+Rs\.?\s*(\d{1,9}(?:,\d{2,3})*(?:\.\d{1,2})?)(?=\s|$)/i,
  );

  if (!amountMatch) {
    return {
      ok: false,
      ignored: true,
      reason: "not_hdfc_outgoing",
    };
  }

  const amount = Number(amountMatch[1].replace(/,/g, ""));

  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999) {
    return {
      ok: false,
      ignored: false,
      reason: "invalid_amount",
    };
  }

  const accountSuffix = collapsedText.match(
    /\bFrom\s+HDFC\s+Bank\s+A\/C\s+\*(\d{4})\b/i,
  )?.[1];

  if (!accountSuffix) {
    return {
      ok: false,
      ignored: false,
      reason: "missing_account",
    };
  }

  const payee = collapsedText
    .match(/\bTo\s+(.+?)\s+On\s+\d{2}[/-]\d{2}[/-]\d{2,4}\b/i)?.[1]
    .trim()
    .slice(0, 120);

  if (!payee || !/[\p{L}\p{N}]/u.test(payee)) {
    return {
      ok: false,
      ignored: false,
      reason: "missing_payee",
    };
  }

  const dateText = collapsedText.match(
    /\bOn\s+(\d{2}[/-]\d{2}[/-]\d{2,4})\b/i,
  )?.[1];
  const expenseDate = dateText ? parseHdfcDate(dateText) : null;

  if (!expenseDate) {
    return {
      ok: false,
      ignored: false,
      reason: "invalid_date",
    };
  }

  const reference = collapsedText
    .match(
      /\bRef\s+([\p{L}\p{N}][\p{L}\p{N}/_-]{0,99})(?=\s+Not\s+You\?|\s+Call\s+|$)/iu,
    )?.[1]
    .trim()
    .slice(0, 100);

  if (!reference || !/[\p{L}\p{N}]/u.test(reference)) {
    return {
      ok: false,
      ignored: false,
      reason: "missing_reference",
    };
  }

  return {
    ok: true,
    value: {
      accountSuffix,
      amount,
      category: detectExpenseCategory(payee),
      expenseDate,
      payee,
      reference,
    },
  };
}

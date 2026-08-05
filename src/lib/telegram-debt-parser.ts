export type DebtType = "LENT" | "BORROWED";

export type ParsedDebt = {
  amount: number;
  description: string | null;
  personName: string;
  recordType: DebtType;
  moneyDate: string;
};

export type DebtParseFailureReason =
  | "not_debt"
  | "missing_amount"
  | "missing_person"
  | "invalid_amount"
  | "invalid_date"
  | "unrecognized_format";

export type DebtParseResult =
  | { ok: true; value: ParsedDebt }
  | { ok: false; reason: DebtParseFailureReason };

type DebtPattern = {
  pattern: RegExp;
  recordType: DebtType;
};

const amountValuePattern =
  "-?[0-9][0-9,]*(?:\\.[0-9]+)?(?:\\s*(?:k|thousand|l|lac|lakh|lakhs))?";
const amountPattern =
  `(?:₹\\s*|rs\\.?\\s*|inr\\s*)?` +
  `(?<amount>${amountValuePattern})` +
  `(?:\\s*(?:₹|rs\\.?|inr|rupees?|/-))?`;
const personPattern = "(?<person>.+?)";

const debtPatterns: DebtPattern[] = [
  {
    pattern: new RegExp(
      `^(?:i\\s+)?(?:borrowed|borrow)\\s+(?:money\\s+)?${amountPattern}\\s+(?:from\\s+)?${personPattern}$`,
      "iu",
    ),
    recordType: "BORROWED",
  },
  {
    pattern: new RegExp(
      `^(?:i\\s+)?(?:borrowed|borrow)\\s+(?:money\\s+)?from\\s+${personPattern}\\s+${amountPattern}$`,
      "iu",
    ),
    recordType: "BORROWED",
  },
  {
    pattern: new RegExp(
      `^(?:i\\s+)?(?:borrowed|borrow)\\s+(?:money\\s+)?${personPattern}\\s+${amountPattern}$`,
      "iu",
    ),
    recordType: "BORROWED",
  },
  {
    pattern: new RegExp(
      `^${amountPattern}\\s+(?:borrowed|borrow)\\s+(?:from\\s+)?${personPattern}$`,
      "iu",
    ),
    recordType: "BORROWED",
  },
  {
    pattern: new RegExp(
      `^(?:i\\s+)?owe\\s+${personPattern}\\s+${amountPattern}$`,
      "iu",
    ),
    recordType: "BORROWED",
  },
  {
    pattern: new RegExp(
      `^(?:i\\s+)?owe\\s+${amountPattern}\\s+(?:to\\s+)?${personPattern}$`,
      "iu",
    ),
    recordType: "BORROWED",
  },
  {
    pattern: new RegExp(
      `^${personPattern}\\s+(?:lent|loaned|gave)\\s+(?:me\\s+)?${amountPattern}(?:\\s+to\\s+me)?$`,
      "iu",
    ),
    recordType: "BORROWED",
  },
  {
    pattern: new RegExp(
      `^(?:got|received)\\s+${amountPattern}\\s+from\\s+${personPattern}$`,
      "iu",
    ),
    recordType: "BORROWED",
  },
  {
    pattern: new RegExp(
      `^(?:i\\s+)?(?:lent|leant|lend|loaned)\\s+(?:money\\s+)?${amountPattern}\\s+(?:to\\s+)?${personPattern}$`,
      "iu",
    ),
    recordType: "LENT",
  },
  {
    pattern: new RegExp(
      `^(?:i\\s+)?(?:lent|leant|lend|loaned)\\s+(?:money\\s+)?(?:to\\s+)?${personPattern}\\s+${amountPattern}$`,
      "iu",
    ),
    recordType: "LENT",
  },
  {
    pattern: new RegExp(
      `^${amountPattern}\\s+(?:lent|leant|lend)\\s+(?:to\\s+)?${personPattern}$`,
      "iu",
    ),
    recordType: "LENT",
  },
  {
    pattern: new RegExp(
      `^${personPattern}\\s+(?:borrowed|borrow)\\s+(?:money\\s+)?${amountPattern}\\s+from\\s+me$`,
      "iu",
    ),
    recordType: "LENT",
  },
  {
    pattern: new RegExp(
      `^${personPattern}\\s+owes\\s+(?:me\\s+)?${amountPattern}$`,
      "iu",
    ),
    recordType: "LENT",
  },
  {
    pattern: new RegExp(
      `^(?:i\\s+)?gave\\s+${personPattern}\\s+${amountPattern}$`,
      "iu",
    ),
    recordType: "LENT",
  },
  {
    pattern: new RegExp(
      `^(?:i\\s+)?gave\\s+${amountPattern}\\s+to\\s+${personPattern}$`,
      "iu",
    ),
    recordType: "LENT",
  },
];

const monthNumbers: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const monthNamePattern = Object.keys(monthNumbers).join("|");

const invalidPersonNames = new Set([
  "from",
  "me",
  "money",
  "myself",
  "person",
  "somebody",
  "someone",
  "to",
]);

function formatDateParts(year: number, month: number, day: number) {
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    year < 1900 ||
    year > 9999 ||
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDateInIndia(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function shiftIndiaDate(date: Date, days: number): string {
  const indiaDate = getDateInIndia(date);
  const shifted = new Date(`${indiaDate}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function resolveYear(
  month: number,
  day: number,
  suppliedYear: string | undefined,
  now: Date,
): number {
  if (suppliedYear) {
    const numericYear = Number(suppliedYear);
    return suppliedYear.length === 2 ? 2000 + numericYear : numericYear;
  }

  const today = getDateInIndia(now);
  const currentYear = Number(today.slice(0, 4));
  const candidate = formatDateParts(currentYear, month, day);

  return candidate && candidate > today ? currentYear - 1 : currentYear;
}

export function parseMoneyDate(
  value: string | undefined,
  now = new Date(),
): string | null {
  if (!value) {
    return getDateInIndia(now);
  }

  const normalized = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/(\d+)(?:st|nd|rd|th)\b/g, "$1")
    .replace(/\s+/g, " ");

  if (normalized === "today") {
    return getDateInIndia(now);
  }

  if (normalized === "yesterday") {
    return shiftIndiaDate(now, -1);
  }

  if (normalized === "day before yesterday") {
    return shiftIndiaDate(now, -2);
  }

  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (isoMatch) {
    return formatDateParts(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
    );
  }

  const numericMatch = normalized.match(
    /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/,
  );

  if (numericMatch) {
    return formatDateParts(
      resolveYear(
        Number(numericMatch[2]),
        Number(numericMatch[1]),
        numericMatch[3],
        now,
      ),
      Number(numericMatch[2]),
      Number(numericMatch[1]),
    );
  }

  const dayFirstMatch = normalized.match(
    /^(\d{1,2})\s+([a-z]+)(?:\s+(\d{2}|\d{4}))?$/,
  );
  const monthFirstMatch = normalized.match(
    /^([a-z]+)\s+(\d{1,2})(?:\s+(\d{2}|\d{4}))?$/,
  );
  const monthName = dayFirstMatch?.[2] ?? monthFirstMatch?.[1];
  const month = monthName ? monthNumbers[monthName] : undefined;

  if (!month) {
    return null;
  }

  const day = Number(dayFirstMatch?.[1] ?? monthFirstMatch?.[2]);
  const suppliedYear = dayFirstMatch?.[3] ?? monthFirstMatch?.[3];

  return formatDateParts(
    resolveYear(month, day, suppliedYear, now),
    month,
    day,
  );
}

function normalizeInput(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
}

function extractDate(
  text: string,
  now: Date,
):
  | { ok: true; coreText: string; moneyDate: string }
  | { ok: false; reason: "invalid_date" } {
  const explicitDate = text.match(
    /^(.*?)(?:\s+(?:on|dated)\s+)([^;]+)$/i,
  );

  if (explicitDate) {
    const moneyDate = parseMoneyDate(explicitDate[2], now);

    return moneyDate
      ? { ok: true, coreText: explicitDate[1].trim(), moneyDate }
      : { ok: false, reason: "invalid_date" };
  }

  const relativeDate = text.match(
    /^(.*?)\s+(today|yesterday|day before yesterday)$/i,
  );

  if (relativeDate) {
    const moneyDate = parseMoneyDate(relativeDate[2], now);

    return moneyDate
      ? { ok: true, coreText: relativeDate[1].trim(), moneyDate }
      : { ok: false, reason: "invalid_date" };
  }

  const implicitDate = text.match(
    new RegExp(
      `^(.*?)\\s+((?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${monthNamePattern})(?:\\s+\\d{2,4})?|(?:${monthNamePattern})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s+\\d{2,4})?|\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?|\\d{4}-\\d{1,2}-\\d{1,2}))$`,
      "i",
    ),
  );

  if (implicitDate) {
    const moneyDate = parseMoneyDate(implicitDate[2], now);

    if (moneyDate) {
      return {
        ok: true,
        coreText: implicitDate[1].trim(),
        moneyDate,
      };
    }

    return { ok: false, reason: "invalid_date" };
  }

  return {
    ok: true,
    coreText: text,
    moneyDate: getDateInIndia(now),
  };
}

function extractDescription(text: string): {
  coreText: string;
  description: string | null;
} {
  const noteMatch = text.match(/^(.*?)\s+(?:for|note:?)\s+(.+)$/i);

  if (!noteMatch) {
    return { coreText: text, description: null };
  }

  const description = noteMatch[2].trim().slice(0, 200);

  return {
    coreText: noteMatch[1].trim(),
    description: description || null,
  };
}

function parseAmount(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  const amountMatch = normalized.match(
    /^(-?[0-9][0-9,]*(?:\.[0-9]+)?)(?:\s*(k|thousand|l|lac|lakh|lakhs))?$/,
  );

  if (!amountMatch) {
    return null;
  }

  const numberText = amountMatch[1];
  const suffix = amountMatch[2];
  const unsigned = numberText.startsWith("-")
    ? numberText.slice(1)
    : numberText;
  const integerPart = unsigned.split(".")[0];
  const decimalPart = unsigned.split(".")[1];
  const plainNumber = /^\d+$/.test(integerPart);
  const westernGrouping = /^\d{1,3}(?:,\d{3})+$/.test(integerPart);
  const indianGrouping = /^\d{1,3}(?:,\d{2})*,\d{3}$/.test(
    integerPart,
  );

  if (
    (!plainNumber && !westernGrouping && !indianGrouping) ||
    (decimalPart !== undefined && decimalPart.length > 2)
  ) {
    return null;
  }

  const multiplier =
    suffix === "k" || suffix === "thousand"
      ? 1_000
      : suffix === "l" ||
          suffix === "lac" ||
          suffix === "lakh" ||
          suffix === "lakhs"
        ? 100_000
        : 1;
  const amount = Number(numberText.replace(/,/g, "")) * multiplier;

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 9_999_999_999.99
  ) {
    return null;
  }

  return amount;
}

function cleanPersonName(value: string): string | null {
  const personName = value
    .trim()
    .replace(/^[,;:\-]+|[,;:\-]+$/g, "")
    .replace(/\s+/g, " ");
  const normalized = personName.toLocaleLowerCase("en-IN");

  if (
    personName.length === 0 ||
    personName.length > 80 ||
    !/[\p{L}]/u.test(personName) ||
    invalidPersonNames.has(normalized)
  ) {
    return null;
  }

  return personName;
}

export function isDebtIntent(text: string): boolean {
  return /\b(?:borrowed|borrow|owe|owes|lent|leant|lend|loan|loaned|gave|got|received)\b/i.test(
    text,
  );
}

export function normalizePersonName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN");
}

export function parseDebtInput(
  text: string,
  now = new Date(),
): DebtParseResult {
  const normalizedText = normalizeInput(text);

  if (!isDebtIntent(normalizedText)) {
    return { ok: false, reason: "not_debt" };
  }

  let datedInput = extractDate(normalizedText, now);
  let describedInput;

  if (!datedInput.ok) {
    const descriptionFirst = extractDescription(normalizedText);

    if (!descriptionFirst.description) {
      return datedInput;
    }

    datedInput = extractDate(descriptionFirst.coreText, now);

    if (!datedInput.ok) {
      return datedInput;
    }

    describedInput = {
      coreText: datedInput.coreText,
      description: descriptionFirst.description,
    };
  } else {
    describedInput = extractDescription(datedInput.coreText);
  }

  for (const debtPattern of debtPatterns) {
    const match = describedInput.coreText.match(debtPattern.pattern);

    if (!match?.groups) {
      continue;
    }

    const amount = parseAmount(match.groups.amount);
    const personName = cleanPersonName(match.groups.person);

    if (amount === null) {
      return { ok: false, reason: "invalid_amount" };
    }

    if (!personName) {
      return { ok: false, reason: "missing_person" };
    }

    return {
      ok: true,
      value: {
        amount,
        description: describedInput.description,
        personName,
        recordType: debtPattern.recordType,
        moneyDate: datedInput.moneyDate,
      },
    };
  }

  if (!/\d/.test(describedInput.coreText)) {
    return { ok: false, reason: "missing_amount" };
  }

  if (
    new RegExp(
      `^(?:i\\s+)?(?:borrowed|borrow|owe|lent|leant|lend|loaned|gave|got|received)\\s+(?:money\\s+)?${amountPattern}$`,
      "iu",
    ).test(describedInput.coreText)
  ) {
    return { ok: false, reason: "missing_person" };
  }

  if (/\d[\d,.]*\d|\d/.test(describedInput.coreText)) {
    const numericToken = describedInput.coreText.match(/-?[\d,.]+/)?.[0];

    if (numericToken && parseAmount(numericToken) === null) {
      return { ok: false, reason: "invalid_amount" };
    }
  }

  return { ok: false, reason: "unrecognized_format" };
}

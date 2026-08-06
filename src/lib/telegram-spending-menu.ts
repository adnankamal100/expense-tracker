import { expenseCategoryIcons } from "./expense-categories.ts";

const APP_TIME_ZONE = "Asia/Kolkata";

export type SpendingPeriod = "today" | "week" | "month";

export type SpendingExpense = {
  amount: number | string;
  category: string;
  expense_date: string;
};

export type SpendingDateRange = {
  endDate: string;
  startDate: string;
};

export type SpendingMenuView = {
  replyMarkup: {
    inline_keyboard: Array<
      Array<{
        callback_data: string;
        text: string;
      }>
    >;
  };
  text: string;
};

const periodLabels: Record<SpendingPeriod, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function getDateInAppTimeZone(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: APP_TIME_ZONE,
    year: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function subtractDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);

  return value.toISOString().slice(0, 10);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

function buildPeriodButtons(selectedPeriod: SpendingPeriod) {
  const options: Array<{
    label: string;
    period: SpendingPeriod;
  }> = [
    { label: "Today", period: "today" },
    { label: "Week", period: "week" },
    { label: "Month", period: "month" },
  ];

  return {
    inline_keyboard: [
      options.map((option) => ({
        text: `${option.period === selectedPeriod ? "✅ " : ""}${option.label}`,
        callback_data: `spending:${option.period}`,
      })),
    ],
  };
}

export function getSpendingDateRange(
  period: SpendingPeriod,
  now = new Date(),
): SpendingDateRange {
  const endDate = getDateInAppTimeZone(now);

  if (period === "today") {
    return { startDate: endDate, endDate };
  }

  if (period === "month") {
    return {
      startDate: `${endDate.slice(0, 7)}-01`,
      endDate,
    };
  }

  const currentDay = new Date(`${endDate}T00:00:00Z`).getUTCDay();
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;

  return {
    startDate: subtractDays(endDate, daysFromMonday),
    endDate,
  };
}

export function parseSpendingCallbackData(
  data: string,
): SpendingPeriod | null {
  const match = data.match(/^spending:(today|week|month)$/);

  return (match?.[1] as SpendingPeriod | undefined) ?? null;
}

export function buildSpendingMenu(
  expenses: SpendingExpense[],
  period: SpendingPeriod,
  now = new Date(),
): SpendingMenuView {
  const range = getSpendingDateRange(period, now);
  const periodExpenses = expenses.filter(
    (expense) =>
      expense.expense_date >= range.startDate &&
      expense.expense_date <= range.endDate,
  );
  const total = periodExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0,
  );
  const categoryTotals = periodExpenses.reduce<Record<string, number>>(
    (totals, expense) => {
      totals[expense.category] =
        (totals[expense.category] ?? 0) + Number(expense.amount);

      return totals;
    },
    {},
  );
  const categoryLines = Object.entries(categoryTotals)
    .sort(([, firstAmount], [, secondAmount]) =>
      secondAmount - firstAmount,
    )
    .map(([category, amount]) => {
      const percentage =
        total > 0 ? Math.round((amount / total) * 100) : 0;

      const icon =
        expenseCategoryIcons[
          category as keyof typeof expenseCategoryIcons
        ] ?? expenseCategoryIcons.Other;

      return `${icon} ${category}: ${formatCurrency(amount)} (${percentage}%)`;
    });
  const dateRange =
    range.startDate === range.endDate
      ? formatDate(range.endDate)
      : `${formatDate(range.startDate)} – ${formatDate(range.endDate)}`;
  const text = [
    "📊 Spending overview",
    `${periodLabels[period]} · ${dateRange}`,
    "",
    `Total: ${formatCurrency(total)}`,
    `Transactions: ${periodExpenses.length}`,
    "",
    ...(categoryLines.length > 0
      ? ["By category:", ...categoryLines]
      : ["No expenses found for this period."]),
  ].join("\n");

  return {
    text,
    replyMarkup: buildPeriodButtons(period),
  };
}

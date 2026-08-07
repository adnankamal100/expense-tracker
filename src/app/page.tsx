"use client";
import DebtSection from "@/components/DebtSection";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { expenseCategoryIcons } from "@/lib/expense-categories";

type Expense = {
  id: number;
  amount: number | string;
  description: string;
  category: string;
  source: string;
  expense_date: string;
  created_at: string;
};

type CategoryPeriod = "today" | "week" | "month";

type WebExpenseResponse = {
  code?: string;
  error?: string;
  expense?: Expense;
};

const categoryPeriodOptions: Array<{
  label: string;
  value: CategoryPeriod;
}> = [
  { label: "Today", value: "today" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
];

const categoryStyles: Record<
  string,
  {
    icon: string;
    badge: string;
    bar: string;
  }
> = {
  Food: {
    icon: expenseCategoryIcons.Food,
    badge:
      "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-800",
    bar: "bg-orange-500",
  },
  Groceries: {
    icon: expenseCategoryIcons.Groceries,
    badge:
      "bg-lime-50 text-lime-700 ring-lime-200 dark:bg-lime-950/50 dark:text-lime-300 dark:ring-lime-800",
    bar: "bg-lime-500",
  },
  Transport: {
    icon: expenseCategoryIcons.Transport,
    badge:
      "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-800",
    bar: "bg-blue-500",
  },
  Bills: {
    icon: expenseCategoryIcons.Bills,
    badge:
      "bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:ring-purple-800",
    bar: "bg-purple-500",
  },
  Housing: {
    icon: expenseCategoryIcons.Housing,
    badge:
      "bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-800",
    bar: "bg-teal-500",
  },
  Shopping: {
    icon: expenseCategoryIcons.Shopping,
    badge:
      "bg-pink-50 text-pink-700 ring-pink-200 dark:bg-pink-950/50 dark:text-pink-300 dark:ring-pink-800",
    bar: "bg-pink-500",
  },
  Entertainment: {
    icon: expenseCategoryIcons.Entertainment,
    badge:
      "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-800",
    bar: "bg-indigo-500",
  },
  Health: {
    icon: expenseCategoryIcons.Health,
    badge:
      "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800",
    bar: "bg-emerald-500",
  },
  Subscriptions: {
    icon: expenseCategoryIcons.Subscriptions,
    badge:
      "bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:ring-cyan-800",
    bar: "bg-cyan-500",
  },
  Education: {
    icon: expenseCategoryIcons.Education,
    badge:
      "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800",
    bar: "bg-amber-500",
  },
  Travel: {
    icon: expenseCategoryIcons.Travel,
    badge:
      "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-800",
    bar: "bg-sky-500",
  },
  Other: {
    icon: expenseCategoryIcons.Other,
    badge:
      "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    bar: "bg-slate-500",
  },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getStartOfWeek(): string {
  const today = new Date();
  const currentDay = today.getDay();
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;

  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);

  return formatLocalDate(monday);
}

function getStartOfMonth(): string {
  const today = new Date();

  return formatLocalDate(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
}

function displayDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export default function Home() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );
  const [darkMode, setDarkMode] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [categoryPeriod, setCategoryPeriod] =
    useState<CategoryPeriod>("month");
  const [telegramLinked, setTelegramLinked] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    async function loadExpenses() {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });

      if (cancelled) {
        return;
      }

      if (error) {
        console.error(error);
        setMessage(`Could not load expenses: ${error.message}`);
        setMessageType("error");
      } else {
        setExpenses((data ?? []) as Expense[]);
      }

      setLoading(false);
    }

    void loadExpenses();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const linkStatus = new URLSearchParams(
      window.location.search,
    ).get("web_link");

    async function checkWebLink() {
      try {
        const response = await fetch("/api/web-expenses", {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          connected?: boolean;
        };

        if (cancelled) {
          return;
        }

        setTelegramLinked(result.connected === true);

        if (linkStatus === "connected" && result.connected) {
          setMessage(
            "Telegram sync connected. Existing and future web expenses will now appear in the bot.",
          );
          setMessageType("success");
        } else if (linkStatus === "invalid") {
          setMessage(
            "That web connection link is invalid. Send /web_setup to the bot for a new link.",
          );
          setMessageType("error");
        } else if (linkStatus === "error") {
          setMessage(
            "Could not connect web expenses. Please try /web_setup again.",
          );
          setMessageType("error");
        }
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setTelegramLinked(false);
        }
      } finally {
        if (linkStatus) {
          window.history.replaceState(
            {},
            "",
            window.location.pathname,
          );
        }
      }
    }

    void checkWebLink();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const savedTheme = localStorage.getItem("expense-tracker-theme");

      const systemPrefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;

      const shouldUseDarkMode =
        savedTheme === "dark" ||
        (savedTheme === null && systemPrefersDark);

      setDarkMode(shouldUseDarkMode);
      document.documentElement.classList.toggle(
        "dark",
        shouldUseDarkMode,
      );
      setThemeLoaded(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleTheme() {
    const nextDarkMode = !darkMode;

    setDarkMode(nextDarkMode);
    document.documentElement.classList.toggle("dark", nextDarkMode);

    localStorage.setItem(
      "expense-tracker-theme",
      nextDarkMode ? "dark" : "light",
    );
  }

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const numericAmount = Number(amount);
    const cleanDescription = description.trim();

    if (
      !cleanDescription ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setMessage("Enter a valid amount and description.");
      setMessageType("error");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/web-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: numericAmount,
          description: cleanDescription,
        }),
      });
      const result = (await response.json()) as WebExpenseResponse;

      if (!response.ok || !result.expense) {
        if (result.code === "web_link_required") {
          setTelegramLinked(false);
          setMessage(
            "Connect this browser first: send /web_setup to the Telegram bot and open its private link.",
          );
        } else {
          setMessage(
            `Could not save expense: ${result.error ?? "Unknown error"}`,
          );
        }
        setMessageType("error");
      } else {
        setExpenses((currentExpenses) => [
          result.expense as Expense,
          ...currentExpenses,
        ]);

        setAmount("");
        setDescription("");
        setMessage(
          `Expense saved under ${result.expense.category} and sent to Telegram.`,
        );
        setMessageType("success");
      }
    } catch (error) {
      console.error(error);
      setMessage("Could not reach the expense service. Please try again.");
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteExpense(id: number) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this expense?",
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(id);

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setMessage(`Could not delete expense: ${error.message}`);
      setMessageType("error");
    } else {
      setExpenses((currentExpenses) =>
        currentExpenses.filter((expense) => expense.id !== id),
      );

      setMessage("Expense deleted.");
      setMessageType("success");
    }

    setDeletingId(null);
  }

  const totalSpent = useMemo(() => {
    return expenses.reduce(
      (total, expense) => total + Number(expense.amount),
      0,
    );
  }, [expenses]);

  const today = formatLocalDate(new Date());
  const startOfWeek = getStartOfWeek();
  const startOfMonth = getStartOfMonth();

  const todaySpent = useMemo(() => {
    return expenses
      .filter((expense) => expense.expense_date === today)
      .reduce(
        (total, expense) => total + Number(expense.amount),
        0,
      );
  }, [expenses, today]);

  const weekSpent = useMemo(() => {
    return expenses
      .filter((expense) => expense.expense_date >= startOfWeek)
      .reduce(
        (total, expense) => total + Number(expense.amount),
        0,
      );
  }, [expenses, startOfWeek]);

  const monthSpent = useMemo(() => {
    return expenses
      .filter((expense) => expense.expense_date >= startOfMonth)
      .reduce(
        (total, expense) => total + Number(expense.amount),
        0,
      );
  }, [expenses, startOfMonth]);

  const categoryPeriodStart =
    categoryPeriod === "today"
      ? today
      : categoryPeriod === "week"
        ? startOfWeek
        : startOfMonth;

  const categoryExpenses = useMemo(() => {
    return expenses.filter(
      (expense) =>
        expense.expense_date >= categoryPeriodStart &&
        expense.expense_date <= today,
    );
  }, [categoryPeriodStart, expenses, today]);

  const categoryPeriodTotal = useMemo(() => {
    return categoryExpenses.reduce(
      (total, expense) => total + Number(expense.amount),
      0,
    );
  }, [categoryExpenses]);

  const categoryTotals = useMemo(() => {
    return categoryExpenses.reduce<Record<string, number>>(
      (totals, expense) => {
        totals[expense.category] =
          (totals[expense.category] ?? 0) +
          Number(expense.amount);

        return totals;
      },
      {},
    );
  }, [categoryExpenses]);

  const sortedCategories = useMemo(() => {
    return Object.entries(categoryTotals).sort(
      ([, firstAmount], [, secondAmount]) =>
        secondAmount - firstAmount,
    );
  }, [categoryTotals]);

  const topCategory = sortedCategories[0];
  const selectedCategoryPeriod =
    categoryPeriodOptions.find(
      (option) => option.value === categoryPeriod,
    ) ?? categoryPeriodOptions[2];
  const categoryPeriodRange =
    categoryPeriodStart === today
      ? displayDate(today)
      : `${displayDate(categoryPeriodStart)} – ${displayDate(today)}`;

  const summaryCards = [
    {
      label: "Today",
      value: todaySpent,
      note: "Current day",
      icon: "☀️",
      background:
        "bg-gradient-to-br from-blue-600 to-cyan-500",
    },
    {
      label: "This Week",
      value: weekSpent,
      note: "Since Monday",
      icon: "📅",
      background:
        "bg-gradient-to-br from-violet-600 to-purple-500",
    },
    {
      label: "This Month",
      value: monthSpent,
      note: "Current month",
      icon: "📊",
      background:
        "bg-gradient-to-br from-emerald-600 to-teal-500",
    },
    {
      label: "All Time",
      value: totalSpent,
      note: `${expenses.length} transactions`,
      icon: "💰",
      background:
        "bg-gradient-to-br from-orange-600 to-amber-500",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                <span
                  className={`h-2 w-2 rounded-full ${
                    telegramLinked
                      ? "bg-emerald-400"
                      : telegramLinked === false
                        ? "bg-amber-400"
                        : "bg-slate-400"
                  }`}
                />
                {telegramLinked === null
                  ? "Checking Telegram sync"
                  : telegramLinked
                    ? "Telegram synced"
                    : "Web link required"}
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Expense Tracker
              </h1>

              <p className="mt-2 text-sm text-slate-400 sm:text-base">
                Track spending from the web or your Telegram bot.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={toggleTheme}
                aria-pressed={darkMode}
                aria-label={
                  darkMode
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                {!themeLoaded
                  ? "Loading theme..."
                  : darkMode
                    ? "☀️ Light mode"
                    : "🌙 Dark mode"}
              </button>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Top category · {selectedCategoryPeriod.label}
                </p>

                <p className="mt-1 text-lg font-semibold text-white">
                  {topCategory
                    ? `${
                        categoryStyles[topCategory[0]]?.icon ?? "📦"
                      } ${topCategory[0]}`
                    : `No spending ${
                        categoryPeriod === "today"
                          ? "today"
                          : categoryPeriod === "week"
                            ? "this week"
                            : "this month"
                      }`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className={`${card.background} rounded-2xl p-5 text-white shadow-lg shadow-slate-300/40 dark:shadow-none`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80">
                    {card.label}
                  </p>

                  <p className="mt-3 text-2xl font-bold tracking-tight">
                    {formatCurrency(card.value)}
                  </p>

                  <p className="mt-2 text-xs text-white/75">
                    {card.note}
                  </p>
                </div>

                <div className="rounded-xl bg-white/20 p-3 text-xl">
                  {card.icon}
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-violet-600 dark:text-violet-400">
              Quick entry
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              Add a new expense
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              The category will be detected automatically.
            </p>

            {telegramLinked === false && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                Send <strong>/web_setup</strong> to the Telegram bot in
                private chat, then open its link in this browser.
              </div>
            )}

            <form onSubmit={addExpense} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="amount"
                  className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  Amount
                </label>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-slate-400">
                    ₹
                  </span>

                  <input
                    id="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3.5 pl-9 pr-4 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-violet-950"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  Description
                </label>

                <input
                  id="description"
                  type="text"
                  value={description}
                  maxLength={200}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Example: Fried rice"
                  required
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-violet-950"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-slate-950 px-5 py-3.5 font-semibold text-white shadow-lg transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-violet-600 dark:hover:bg-violet-500"
              >
                {submitting ? "Saving expense..." : "Add expense"}
              </button>
            </form>

            {message && (
              <div
                aria-live="polite"
                className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                  messageType === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                }`}
              >
                {message}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-violet-600 dark:text-violet-400">
                  Overview
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  Spending by category
                </h2>
              </div>

              <div className="flex flex-col gap-2 sm:items-end">
                <div
                  role="group"
                  aria-label="Spending by category period"
                  className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
                >
                  {categoryPeriodOptions.map((option) => {
                    const selected = categoryPeriod === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setCategoryPeriod(option.value)}
                        className={`rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                          selected
                            ? "bg-slate-950 text-white shadow-sm dark:bg-violet-600"
                            : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {sortedCategories.length}{" "}
                  {sortedCategories.length === 1
                    ? "category"
                    : "categories"}
                  {" · "}
                  {categoryPeriodRange}
                </div>
              </div>
            </div>

            {sortedCategories.length === 0 ? (
              <div className="flex min-h-72 items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl">📊</div>

                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No spending {categoryPeriod === "today"
                      ? "today"
                      : categoryPeriod === "week"
                        ? "this week"
                        : "this month"}
                  </p>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Add an expense in this period to see your breakdown.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-7 space-y-6">
                {sortedCategories.map(([category, total]) => {
                  const style =
                    categoryStyles[category] ?? categoryStyles.Other;

                  const percentage =
                    categoryPeriodTotal > 0
                      ? Math.round(
                          (total / categoryPeriodTotal) * 100,
                        )
                      : 0;

                  return (
                    <div key={category}>
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg dark:bg-slate-800">
                            {style.icon}
                          </div>

                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                              {category}
                            </p>

                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {percentage}% of selected spending
                            </p>
                          </div>
                        </div>

                        <p className="font-bold text-slate-900 dark:text-white">
                          {formatCurrency(total)}
                        </p>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full ${style.bar}`}
                          style={{
                            width: `${Math.max(percentage, 3)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-6 py-5 dark:border-slate-800 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-violet-600 dark:text-violet-400">
                Activity
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                Recent expenses
              </h2>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Latest transactions from web and Telegram
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600 dark:border-slate-700 dark:border-t-violet-400" />

                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Loading expenses...
                </p>
              </div>
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="text-center">
                <div className="text-4xl">🧾</div>

                <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                  No expenses added
                </p>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Add your first expense using the form or Telegram.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {expenses.map((expense) => {
                const style =
                  categoryStyles[expense.category] ??
                  categoryStyles.Other;

                return (
                  <div
                    key={expense.id}
                    className="flex flex-col gap-4 px-6 py-5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-xl dark:bg-slate-800">
                        {style.icon}
                      </div>

                      <div>
                        <p className="font-semibold capitalize text-slate-900 dark:text-white">
                          {expense.description}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style.badge}`}
                          >
                            {expense.category}
                          </span>

                          <span className="text-xs text-slate-400">
                            {displayDate(expense.expense_date)}
                          </span>

                          <span className="text-xs text-slate-400">
                            •
                          </span>

                          <span className="text-xs capitalize text-slate-500 dark:text-slate-400">
                            {expense.source === "telegram"
                              ? "Telegram"
                              : "Web"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-5 sm:justify-end">
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(Number(expense.amount))}
                      </p>

                      <button
                        type="button"
                        disabled={deletingId === expense.id}
                        onClick={() =>
                          void deleteExpense(expense.id)
                        }
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        {deletingId === expense.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <DebtSection />
        <footer className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
          Expense Tracker · Synced with Supabase and Telegram
        </footer>
      </div>
    </main>
  );
}

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Expense = {
  id: number;
  amount: number;
  description: string;
  category: string;
  source: string;
  expense_date: string;
  created_at: string;
};

const categoryKeywords: Record<string, string[]> = {
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

function detectCategory(description: string): string {
  const text = description.toLowerCase();

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return category;
    }
  }

  return "Other";
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function Home() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function loadExpenses() {
    setLoading(true);

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage(`Could not load expenses: ${error.message}`);
    } else {
      setExpenses(data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadExpenses();
  }, []);

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const numericAmount = Number(amount);
    const cleanDescription = description.trim();

    if (!cleanDescription || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setMessage("Enter a valid amount and description.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const category = detectCategory(cleanDescription);

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        amount: numericAmount,
        description: cleanDescription,
        category,
        source: "web",
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setMessage(`Could not save expense: ${error.message}`);
    } else {
      setExpenses((currentExpenses) => [
        data as Expense,
        ...currentExpenses,
      ]);

      setAmount("");
      setDescription("");
      setMessage("Expense saved successfully.");
    }

    setSubmitting(false);
  }

  async function deleteExpense(id: number) {
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setMessage(`Could not delete expense: ${error.message}`);
      return;
    }

    setExpenses((currentExpenses) =>
      currentExpenses.filter((expense) => expense.id !== id),
    );

    setMessage("Expense deleted.");
  }

  const totalSpent = useMemo(() => {
    return expenses.reduce(
      (total, expense) => total + Number(expense.amount),
      0,
    );
  }, [expenses]);

  const categoryTotals = useMemo(() => {
    return expenses.reduce<Record<string, number>>((totals, expense) => {
      totals[expense.category] =
        (totals[expense.category] ?? 0) + Number(expense.amount);

      return totals;
    }, {});
  }, [expenses]);

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold">Expense Tracker</h1>

        <p className="mt-2 text-gray-600">
          Track your daily expenses and category spending.
        </p>

        <form
          onSubmit={addExpense}
          className="mt-8 grid gap-4 rounded-xl bg-white p-6 shadow md:grid-cols-3"
        >
          <div>
            <label
              htmlFor="amount"
              className="mb-2 block text-sm font-medium"
            >
              Amount
            </label>

            <input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="100"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-medium"
            >
              Description
            </label>

            <input
              id="description"
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Fried rice"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {submitting ? "Saving..." : "Add Expense"}
            </button>
          </div>
        </form>

        {message && (
          <p className="mt-4 rounded-lg bg-white p-3 text-sm shadow">
            {message}
          </p>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">Total Spent</p>
            <p className="mt-2 text-3xl font-bold">
              {formatCurrency(totalSpent)}
            </p>
          </div>

          {Object.entries(categoryTotals).map(([category, total]) => (
            <div
              key={category}
              className="rounded-xl bg-white p-6 shadow"
            >
              <p className="text-sm text-gray-500">{category}</p>
              <p className="mt-2 text-3xl font-bold">
                {formatCurrency(total)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">Recent Expenses</h2>

          {loading ? (
            <p className="mt-4 text-gray-500">Loading expenses...</p>
          ) : expenses.length === 0 ? (
            <p className="mt-4 text-gray-500">
              No expenses added yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                >
                  <div>
                    <p className="font-semibold">
                      {expense.description}
                    </p>

                    <p className="text-sm text-gray-500">
                      {expense.category} · {expense.expense_date}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <p className="font-bold">
                      {formatCurrency(Number(expense.amount))}
                    </p>

                    <button
                      type="button"
                      onClick={() => void deleteExpense(expense.id)}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type DebtType = "LENT" | "BORROWED";
type DebtStatus = "OPEN" | "SETTLED";

type Debt = {
  id: number;
  record_type: DebtType;
  person_name: string;
  amount: number | string;
  description: string | null;
  due_date: string | null;
  status: DebtStatus;
  created_at: string;
  settled_at: string | null;
};

type PersonBalance = {
  key: string;
  personName: string;
  netAmount: number;
  records: Debt[];
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function displayDate(date: string | null): string {
  if (!date) {
    return "Date not recorded";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizePersonName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN");
}

function getMoneyDate(debt: Debt): string {
  return debt.due_date ?? debt.created_at.slice(0, 10);
}

export default function DebtSection() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [recordType, setRecordType] = useState<DebtType>("LENT");
  const [personName, setPersonName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [moneyDate, setMoneyDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [settlingPersonKey, setSettlingPersonKey] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMoneyDate(formatLocalDate(new Date()));
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDebts() {
      const { data, error } = await supabase
        .from("debts")
        .select("*")
        .order("created_at", { ascending: false });

      if (cancelled) {
        return;
      }

      if (error) {
        console.error(error);
        setMessage(`Could not load records: ${error.message}`);
      } else {
        setDebts((data ?? []) as Debt[]);
      }

      setLoading(false);
    }

    void loadDebts();

    return () => {
      cancelled = true;
    };
  }, []);

  async function addDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const numericAmount = Number(amount);
    const cleanName = personName.trim();

    if (
      !cleanName ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setMessage("Enter a valid person name and amount.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const { data, error } = await supabase
      .from("debts")
      .insert({
        record_type: recordType,
        person_name: cleanName,
        amount: numericAmount,
        description: description.trim() || null,
        // The existing column is retained for database compatibility, but it
        // now stores the date on which the money changed hands.
        due_date: moneyDate || formatLocalDate(new Date()),
        status: "OPEN",
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setMessage(`Could not save record: ${error.message}`);
    } else {
      setDebts((current) => [data as Debt, ...current]);
      setPersonName("");
      setAmount("");
      setDescription("");
      setMoneyDate(formatLocalDate(new Date()));
      setMessage(
        recordType === "LENT"
          ? "Money lent entry added and balances recalculated."
          : "Money borrowed entry added and balances recalculated.",
      );
    }

    setSubmitting(false);
  }

  async function markSettled(balance: PersonBalance) {
    setSettlingPersonKey(balance.key);
    setMessage("");

    const recordIds = balance.records.map((record) => record.id);

    const { data, error } = await supabase
      .from("debts")
      .update({
        status: "SETTLED",
        settled_at: new Date().toISOString(),
      })
      .in("id", recordIds)
      .select();

    if (error) {
      console.error(error);
      setMessage(`Could not settle record: ${error.message}`);
    } else {
      const updatedRecords = new Map(
        ((data ?? []) as Debt[]).map((record) => [record.id, record]),
      );

      setDebts((current) =>
        current.map((item) =>
          updatedRecords.get(item.id) ?? item,
        ),
      );

      setMessage(`Balance with ${balance.personName} marked as settled.`);
    }

    setSettlingPersonKey(null);
  }

  async function reopenDebt(debt: Debt) {
    setUpdatingId(debt.id);
    setMessage("");

    const { data, error } = await supabase
      .from("debts")
      .update({
        status: "OPEN",
        settled_at: null,
      })
      .eq("id", debt.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      setMessage(`Could not reopen record: ${error.message}`);
    } else {
      setDebts((current) =>
        current.map((item) =>
          item.id === debt.id ? (data as Debt) : item,
        ),
      );

      setMessage("Record reopened.");
    }

    setUpdatingId(null);
  }

  async function deleteDebt(id: number) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this record?",
    );

    if (!confirmed) {
      return;
    }

    setUpdatingId(id);

    const { error } = await supabase
      .from("debts")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setMessage(`Could not delete record: ${error.message}`);
    } else {
      setDebts((current) =>
        current.filter((debt) => debt.id !== id),
      );

      setMessage("Record deleted.");
    }

    setUpdatingId(null);
  }

  const openDebts = useMemo(
    () => debts.filter((debt) => debt.status === "OPEN"),
    [debts],
  );

  const settledDebts = useMemo(
    () => debts.filter((debt) => debt.status === "SETTLED"),
    [debts],
  );

  const personBalances = useMemo(() => {
    const balances = new Map<string, PersonBalance>();

    for (const debt of openDebts) {
      const key = normalizePersonName(debt.person_name);
      const existing = balances.get(key) ?? {
        key,
        personName: debt.person_name,
        netAmount: 0,
        records: [],
      };

      existing.netAmount +=
        debt.record_type === "LENT"
          ? Number(debt.amount)
          : -Number(debt.amount);
      existing.records.push(debt);
      balances.set(key, existing);
    }

    return Array.from(balances.values()).sort(
      (first, second) =>
        Math.abs(second.netAmount) - Math.abs(first.netAmount),
    );
  }, [openDebts]);

  const activeBalances = useMemo(
    () =>
      personBalances.filter(
        (balance) => Math.abs(balance.netAmount) >= 0.005,
      ),
    [personBalances],
  );

  const totalLent = useMemo(
    () =>
      activeBalances.reduce(
        (total, balance) =>
          balance.netAmount > 0 ? total + balance.netAmount : total,
        0,
      ),
    [activeBalances],
  );

  const totalBorrowed = useMemo(
    () =>
      activeBalances.reduce(
        (total, balance) =>
          balance.netAmount < 0
            ? total + Math.abs(balance.netAmount)
            : total,
        0,
      ),
    [activeBalances],
  );

  return (
    <section className="mt-8">
      <div className="mb-5">
        <p className="text-sm font-medium text-violet-600 dark:text-violet-400">
          Money tracking
        </p>

        <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
          Borrowed & Lent
        </h2>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Track money exchanged with each person. Opposite entries are
          automatically offset to show the remaining balance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 p-5 text-white shadow-lg">
          <p className="text-sm font-medium text-white/80">
            Money owed to you
          </p>

          <p className="mt-3 text-3xl font-bold">
            {formatCurrency(totalLent)}
          </p>

          <p className="mt-2 text-xs text-white/75">
            {
              activeBalances.filter(
                (balance) => balance.netAmount > 0,
              ).length
            }{" "}
            people with an open balance
          </p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-rose-600 to-orange-500 p-5 text-white shadow-lg">
          <p className="text-sm font-medium text-white/80">
            Money you owe
          </p>

          <p className="mt-3 text-3xl font-bold">
            {formatCurrency(totalBorrowed)}
          </p>

          <p className="mt-2 text-xs text-white/75">
            {
              activeBalances.filter(
                (balance) => balance.netAmount < 0,
              ).length
            }{" "}
            people with an open balance
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <form
          onSubmit={addDebt}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Add a record
          </h3>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRecordType("LENT")}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                recordType === "LENT"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
              }`}
            >
              They borrowed from me
            </button>

            <button
              type="button"
              onClick={() => setRecordType("BORROWED")}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                recordType === "BORROWED"
                  ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
              }`}
            >
              I borrowed from them
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="person-name"
                className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Person name
              </label>

              <input
                id="person-name"
                value={personName}
                onChange={(event) =>
                  setPersonName(event.target.value)
                }
                placeholder="Example: Rahul"
                required
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-violet-950"
              />
            </div>

            <div>
              <label
                htmlFor="debt-amount"
                className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Amount
              </label>

              <input
                id="debt-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="1000"
                required
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-violet-950"
              />
            </div>

            <div>
              <label
                htmlFor="debt-description"
                className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Description
              </label>

              <input
                id="debt-description"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Optional note"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-violet-950"
              />
            </div>

            <div>
              <label
                htmlFor="money-date"
                className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Money given/received date
              </label>

              <input
                id="money-date"
                type="date"
                value={moneyDate}
                onChange={(event) => setMoneyDate(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-violet-950"
              />

              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Use the date the money actually changed hands.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full rounded-xl bg-slate-950 px-5 py-3.5 font-semibold text-white transition hover:bg-violet-600 disabled:bg-slate-400 dark:bg-violet-600 dark:hover:bg-violet-500"
          >
            {submitting ? "Saving..." : "Add record"}
          </button>

          {message && (
            <p
              aria-live="polite"
              className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {message}
            </p>
          )}
        </form>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Balances by person
            </h3>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Lent and borrowed entries for the same person are netted
              together.
            </p>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-slate-500">
              Loading records...
            </p>
          ) : personBalances.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              No open balances.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {personBalances.map((balance) => {
                const owesYou = balance.netAmount > 0.005;
                const youOwe = balance.netAmount < -0.005;
                const isEven = !owesYou && !youOwe;

                return (
                  <div
                    key={balance.key}
                    className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {balance.personName}
                          </p>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              owesYou
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                : youOwe
                                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {owesYou
                              ? "Owes you"
                              : youOwe
                                ? "You owe"
                                : "Fully offset"}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-400">
                          {balance.records.length}{" "}
                          {balance.records.length === 1
                            ? "entry"
                            : "entries"}{" "}
                          · Latest: {displayDate(getMoneyDate(balance.records[0]))}
                        </p>
                      </div>

                      <div className="sm:text-right">
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatCurrency(Math.abs(balance.netAmount))}
                        </p>

                        <button
                          type="button"
                          disabled={settlingPersonKey === balance.key}
                          onClick={() => void markSettled(balance)}
                          className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {settlingPersonKey === balance.key
                            ? "Saving..."
                            : isEven
                              ? "Archive settled entries"
                              : "Mark balance settled"}
                        </button>
                      </div>
                    </div>

                    <details className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <summary className="cursor-pointer text-xs font-semibold text-violet-600 dark:text-violet-400">
                        View individual entries
                      </summary>

                      <div className="mt-3 space-y-2">
                        {balance.records.map((debt) => (
                          <div
                            key={debt.id}
                            className="flex flex-col justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60 sm:flex-row sm:items-center"
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {debt.record_type === "LENT"
                                  ? "They borrowed from you"
                                  : "You borrowed from them"}{" "}
                                · {formatCurrency(Number(debt.amount))}
                              </p>

                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {displayDate(getMoneyDate(debt))}
                                {debt.description
                                  ? ` · ${debt.description}`
                                  : ""}
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={updatingId === debt.id}
                              onClick={() => void deleteDebt(debt.id)}
                              className="self-start rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40 sm:self-auto"
                            >
                              {updatingId === debt.id
                                ? "Deleting..."
                                : "Delete entry"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {settledDebts.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Settled records
            </h3>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {settledDebts.map((debt) => (
              <div
                key={debt.id}
                className="flex flex-col justify-between gap-3 px-6 py-4 opacity-70 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-semibold text-slate-900 line-through dark:text-white">
                    {debt.person_name} ·{" "}
                    {formatCurrency(Number(debt.amount))}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {debt.record_type === "LENT"
                      ? "They borrowed from you"
                      : "You borrowed from them"}{" "}
                    · {displayDate(getMoneyDate(debt))} · Settled
                  </p>
                </div>

                <button
                  type="button"
                  disabled={updatingId === debt.id}
                  onClick={() => void reopenDebt(debt)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Reopen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

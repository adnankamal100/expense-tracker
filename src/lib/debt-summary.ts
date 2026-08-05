import {
  normalizePersonName,
  type DebtQueryKind,
  type DebtType,
} from "./telegram-debt-parser.ts";

export type DebtRecord = {
  id?: number | string;
  amount: number | string;
  created_at?: string;
  description?: string | null;
  due_date?: string | null;
  person_name: string;
  record_type: DebtType;
  status: "OPEN" | "SETTLED";
};

export type OutstandingDebtPerson = {
  borrowedAmount: number;
  lentAmount: number;
  netAmount: number;
  personName: string;
  representativeId: number | string | null;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatMoneyDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function getDebtDate(debt: DebtRecord): string {
  return (
    debt.due_date ??
    debt.created_at?.slice(0, 10) ??
    new Date().toISOString().slice(0, 10)
  );
}

function cleanTelegramNote(note: string | null | undefined): string {
  return (note ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function formatDebtEntry(debt: DebtRecord): string {
  const note = cleanTelegramNote(debt.description);

  return `• ${formatCurrency(Number(debt.amount))} — ${formatMoneyDate(getDebtDate(debt))}${note ? ` — ${note}` : ""}`;
}

export function getPersonBalance(
  debts: DebtRecord[],
  personName: string,
): number {
  const normalizedName = normalizePersonName(personName);

  return debts
    .filter(
      (debt) =>
        debt.status === "OPEN" &&
        normalizePersonName(debt.person_name) === normalizedName,
    )
    .reduce(
      (balance, debt) =>
        balance +
        (debt.record_type === "LENT"
          ? Number(debt.amount)
          : -Number(debt.amount)),
      0,
    );
}

export function getOutstandingDebtPeople(
  debts: DebtRecord[],
): OutstandingDebtPerson[] {
  const balances = new Map<
    string,
    OutstandingDebtPerson
  >();

  for (const debt of debts.filter((item) => item.status === "OPEN")) {
    const key = normalizePersonName(debt.person_name);
    const balance = balances.get(key) ?? {
      borrowedAmount: 0,
      lentAmount: 0,
      personName: debt.person_name,
      netAmount: 0,
      representativeId: debt.id ?? null,
    };

    if (balance.representativeId === null && debt.id !== undefined) {
      balance.representativeId = debt.id;
    }

    if (debt.record_type === "LENT") {
      balance.lentAmount += Number(debt.amount);
      balance.netAmount += Number(debt.amount);
    } else {
      balance.borrowedAmount += Number(debt.amount);
      balance.netAmount -= Number(debt.amount);
    }

    balances.set(key, balance);
  }

  return Array.from(balances.values())
    .filter((balance) => Math.abs(balance.netAmount) >= 0.005)
    .sort(
      (first, second) =>
        Math.abs(second.netAmount) - Math.abs(first.netAmount),
    );
}

export function buildDebtSummary(debts: DebtRecord[]): string {
  const outstanding = getOutstandingDebtPeople(debts);

  if (outstanding.length === 0) {
    return "No outstanding borrowed or lent balances.";
  }

  const visibleBalances = outstanding.slice(0, 25);
  const lines = visibleBalances.map((balance) => {
    const netLine =
      balance.netAmount > 0
        ? `${balance.personName} owes you ${formatCurrency(balance.netAmount)}`
        : `You owe ${balance.personName} ${formatCurrency(Math.abs(balance.netAmount))}`;

    return `${netLine}\n  Borrowed: ${formatCurrency(balance.borrowedAmount)} · Lent: ${formatCurrency(balance.lentAmount)}`;
  });

  if (outstanding.length > visibleBalances.length) {
    lines.push(
      `…and ${outstanding.length - visibleBalances.length} more people. Check the dashboard for all balances.`,
    );
  }

  return lines.join("\n\n");
}

export function buildPersonDebtBreakdown(
  debts: DebtRecord[],
  requestedPersonName: string,
  kind: DebtQueryKind,
): string {
  const normalizedName = normalizePersonName(requestedPersonName);
  const personDebts = debts
    .filter(
      (debt) =>
        debt.status === "OPEN" &&
        normalizePersonName(debt.person_name) === normalizedName,
    )
    .sort((first, second) =>
      getDebtDate(second).localeCompare(getDebtDate(first)),
    );
  const personName =
    personDebts.find((debt) => /^\p{Lu}/u.test(debt.person_name))
      ?.person_name ??
    personDebts[0]?.person_name ??
    requestedPersonName;
  const borrowed = personDebts.filter(
    (debt) => debt.record_type === "BORROWED",
  );
  const lent = personDebts.filter((debt) => debt.record_type === "LENT");
  const borrowedTotal = borrowed.reduce(
    (total, debt) => total + Number(debt.amount),
    0,
  );
  const lentTotal = lent.reduce(
    (total, debt) => total + Number(debt.amount),
    0,
  );
  const netAmount = lentTotal - borrowedTotal;

  if (personDebts.length === 0) {
    return `No open borrowed or lent entries found for ${personName}.`;
  }

  const lines: string[] = [];
  const entryGroups: Array<{
    heading: string;
    records: DebtRecord[];
  }> = [];

  if (kind === "BALANCE") {
    lines.push(`🤝 Balance with ${personName}`);
    lines.push("");
    lines.push(
      Math.abs(netAmount) < 0.005
        ? "Net balance: Fully offset (₹0)"
        : netAmount > 0
          ? `Net balance: ${personName} owes you ${formatCurrency(netAmount)}`
          : `Net balance: You owe ${personName} ${formatCurrency(Math.abs(netAmount))}`,
    );
    lines.push(`Borrowed from ${personName}: ${formatCurrency(borrowedTotal)}`);
    lines.push(`Lent to ${personName}: ${formatCurrency(lentTotal)}`);
    entryGroups.push(
      { heading: `You borrowed from ${personName}`, records: borrowed },
      { heading: `${personName} borrowed from you`, records: lent },
    );
  } else if (kind === "BORROWED") {
    lines.push(`💸 Borrowed from ${personName}`);
    lines.push("");
    lines.push(`Total: ${formatCurrency(borrowedTotal)}`);
    entryGroups.push({ heading: "Breakdown", records: borrowed });
  } else {
    lines.push(`💰 Lent to ${personName}`);
    lines.push("");
    lines.push(`Total: ${formatCurrency(lentTotal)}`);
    entryGroups.push({ heading: "Breakdown", records: lent });
  }

  let omittedEntries = 0;

  for (const group of entryGroups) {
    lines.push("");
    lines.push(`${group.heading}:`);

    if (group.records.length === 0) {
      lines.push("• No open entries");
      continue;
    }

    for (const debt of group.records) {
      const entryLine = formatDebtEntry(debt);

      if ([...lines, entryLine].join("\n").length > 3700) {
        omittedEntries += 1;
      } else {
        lines.push(entryLine);
      }
    }
  }

  if (omittedEntries > 0) {
    lines.push("");
    lines.push(
      `…${omittedEntries} more entries are available on the dashboard.`,
    );
  }

  return lines.join("\n");
}

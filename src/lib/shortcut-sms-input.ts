const MESSAGE_TEXT_KEYS = [
  "content",
  "text",
  "body",
  "message",
  "shortcut input",
];

function collectStrings(
  value: unknown,
  depth: number,
  seen: Set<object>,
): string[] {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? [text] : [];
  }

  if (depth <= 0 || !value || typeof value !== "object") {
    return [];
  }

  if (seen.has(value)) {
    return [];
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      collectStrings(item, depth - 1, seen),
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const preferred = entries.filter(([key]) =>
    MESSAGE_TEXT_KEYS.includes(key.trim().toLowerCase()),
  );
  const remaining = entries.filter(
    ([key]) =>
      !MESSAGE_TEXT_KEYS.includes(key.trim().toLowerCase()),
  );

  return [...preferred, ...remaining].flatMap(([, item]) =>
    collectStrings(item, depth - 1, seen),
  );
}

export function getShortcutSmsText(value: unknown): string {
  const candidates = collectStrings(value, 4, new Set());

  return (
    candidates.find((candidate) =>
      /^\s*Sent\s+Rs\.?\s*\d/i.test(candidate),
    ) ??
    candidates.find(
      (candidate) =>
        /\bcredited\s+to\s+HDFC\s+Bank\b/i.test(candidate) ||
        /^\s*Credit\s+Alert!/i.test(candidate),
    ) ??
    candidates.find((candidate) =>
      /\bHDFC\s+Bank\s+A\/C\b/i.test(candidate),
    ) ??
    (candidates.length === 1 ? candidates[0] : "")
  );
}

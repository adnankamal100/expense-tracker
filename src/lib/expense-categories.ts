export const expenseCategories = [
  "Food",
  "Groceries",
  "Transport",
  "Bills",
  "Housing",
  "Shopping",
  "Health",
  "Entertainment",
  "Subscriptions",
  "Education",
  "Travel",
  "Other",
] as const;

export type ExpenseCategory = (typeof expenseCategories)[number];

export const expenseCategoryIcons: Record<ExpenseCategory, string> = {
  Food: "🍽️",
  Groceries: "🛒",
  Transport: "🚕",
  Bills: "🧾",
  Housing: "🏠",
  Shopping: "🛍️",
  Health: "💊",
  Entertainment: "🎬",
  Subscriptions: "🔁",
  Education: "🎓",
  Travel: "✈️",
  Other: "📦",
};

const categoryKeywords: Record<
  Exclude<ExpenseCategory, "Other">,
  readonly string[]
> = {
  Food: [
    "food",
    "meal",
    "meals",
    "restaurant",
    "restaurants",
    "cafe",
    "coffee",
    "tea",
    "breakfast",
    "lunch",
    "dinner",
    "snack",
    "snacks",
    "takeaway",
    "swiggy",
    "zomato",
    "rice",
  ],
  Groceries: [
    "grocery",
    "groceries",
    "supermarket",
    "kirana",
    "provisions",
    "vegetable",
    "vegetables",
    "fruit",
    "fruits",
    "milk",
    "bread",
    "eggs",
    "bigbasket",
    "blinkit",
    "zepto",
    "instamart",
  ],
  Transport: [
    "transport",
    "auto",
    "autorickshaw",
    "uber",
    "ola",
    "rapido",
    "bus",
    "train",
    "metro",
    "taxi",
    "cab",
    "petrol",
    "diesel",
    "fuel",
    "parking",
    "toll",
    "bmtc",
  ],
  Bills: [
    "bill",
    "bills",
    "electricity",
    "electric bill",
    "electricity bill",
    "water bill",
    "gas bill",
    "phone bill",
    "mobile bill",
    "internet",
    "internet bill",
    "broadband",
    "wifi",
    "recharge",
    "utility",
    "utilities",
  ],
  Housing: [
    "rent",
    "house rent",
    "home rent",
    "mortgage",
    "maintenance",
    "apartment maintenance",
    "housing",
    "property tax",
    "home repair",
    "house repair",
    "furniture",
  ],
  Shopping: [
    "shopping",
    "amazon",
    "flipkart",
    "myntra",
    "shirt",
    "shirts",
    "shoe",
    "shoes",
    "clothes",
    "clothing",
    "electronics",
    "appliance",
  ],
  Health: [
    "health",
    "medicine",
    "medicines",
    "doctor",
    "hospital",
    "pharmacy",
    "clinic",
    "dentist",
    "therapy",
    "medical",
    "lab test",
    "insurance",
  ],
  Entertainment: [
    "entertainment",
    "movie",
    "movies",
    "cinema",
    "game",
    "games",
    "concert",
    "bowling",
    "event ticket",
  ],
  Subscriptions: [
    "subscription",
    "subscriptions",
    "netflix",
    "spotify",
    "hotstar",
    "prime video",
    "amazon prime",
    "youtube premium",
    "icloud",
    "google one",
    "membership",
    "saas",
  ],
  Education: [
    "education",
    "school",
    "college",
    "university",
    "course",
    "courses",
    "tuition",
    "class",
    "classes",
    "textbook",
    "textbooks",
    "stationery",
    "exam fee",
    "school fee",
  ],
  Travel: [
    "travel",
    "trip",
    "vacation",
    "holiday",
    "flight",
    "flights",
    "airfare",
    "hotel",
    "hostel",
    "airbnb",
    "resort",
    "visa",
    "passport",
    "tour",
    "luggage",
  ],
};

function normalizeWords(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-IN")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function detectExpenseCategory(
  description: string,
): ExpenseCategory {
  const normalizedDescription = ` ${normalizeWords(description)} `;
  let bestMatch: {
    category: ExpenseCategory;
    score: number;
  } | null = null;

  for (const category of expenseCategories) {
    if (category === "Other") {
      continue;
    }

    for (const keyword of categoryKeywords[category]) {
      const normalizedKeyword = normalizeWords(keyword);

      if (!normalizedDescription.includes(` ${normalizedKeyword} `)) {
        continue;
      }

      const score =
        normalizedKeyword.split(" ").length * 100 +
        normalizedKeyword.length;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { category, score };
      }
    }
  }

  return bestMatch?.category ?? "Other";
}

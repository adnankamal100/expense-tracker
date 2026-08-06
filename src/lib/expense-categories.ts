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
    "bakery",
    "biryani",
    "burger",
    "canteen",
    "chaat",
    "curry",
    "dessert",
    "dosa",
    "fast food",
    "fried rice",
    "ice cream",
    "idli",
    "juice",
    "pizza",
    "sandwich",
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
    "dominos",
    "kfc",
    "mcdonalds",
    "pizza hut",
    "starbucks",
    "cafe coffee day",
  ],
  Groceries: [
    "atta",
    "flour",
    "wheat",
    "rice",
    "dal",
    "pulse",
    "lentil",
    "bean",
    "chickpea",
    "rajma",
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
    "dairy",
    "curd",
    "yogurt",
    "yoghurt",
    "paneer",
    "butter",
    "cheese",
    "ghee",
    "bread",
    "eggs",
    "oat",
    "oats",
    "oatmeal",
    "muesli",
    "cereal",
    "granola",
    "cornflakes",
    "coffee powder",
    "tea powder",
    "tea leaves",
    "cooking oil",
    "spice",
    "masala",
    "salt",
    "sugar",
    "biscuit",
    "cookie",
    "noodles",
    "pasta",
    "sauce",
    "jam",
    "honey",
    "dry fruit",
    "nut",
    "almond",
    "cashew",
    "chicken",
    "meat",
    "fish",
    "bigbasket",
    "blinkit",
    "zepto",
    "instamart",
    "dmart",
    "d mart",
    "reliance fresh",
    "more supermarket",
    "lulu hypermarket",
    "natures basket",
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
    "ksrtc",
    "namma metro",
    "bus pass",
    "metro card",
    "metro recharge",
    "school bus",
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
    "bescom",
    "postpaid",
    "prepaid recharge",
    "dth",
    "gas cylinder",
    "act fibernet",
    "jio recharge",
    "airtel recharge",
    "vi recharge",
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
    "home loan",
    "housing society",
    "society maintenance",
    "plumber",
    "electrician",
    "carpenter",
    "home painting",
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
    "mobile phone",
    "laptop",
    "computer",
    "headphone",
    "watch",
    "bag",
    "cosmetics",
    "beauty product",
    "nykaa",
    "meesho",
    "ajio",
    "ikea",
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
    "apollo pharmacy",
    "1mg",
    "netmeds",
    "pharmeasy",
    "vitamin",
    "supplement",
    "gym",
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
    "bookmyshow",
    "pvr",
    "inox",
    "amusement park",
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
    "disney hotstar",
    "jiocinema",
    "zee5",
    "sonyliv",
    "youtube music",
    "microsoft 365",
    "adobe creative cloud",
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
    "book",
    "notebook",
    "pen",
    "udemy",
    "coursera",
    "unacademy",
    "byjus",
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
    "makemytrip",
    "goibibo",
    "booking com",
    "cleartrip",
    "air india",
    "indigo flight",
    "akasa air",
    "railway reservation",
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

function keywordForms(keyword: string): string[] {
  const words = keyword.split(" ");
  const lastWord = words.at(-1);

  if (!lastWord || lastWord.length < 2) {
    return [keyword];
  }

  let plural: string;

  if (/[^aeiou]y$/i.test(lastWord)) {
    plural = `${lastWord.slice(0, -1)}ies`;
  } else if (/(?:ss|us|x|z|ch|sh)$/i.test(lastWord)) {
    plural = `${lastWord}es`;
  } else if (lastWord.endsWith("s")) {
    return [keyword];
  } else {
    plural = `${lastWord}s`;
  }

  return [keyword, [...words.slice(0, -1), plural].join(" ")];
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

      const matchedForm = keywordForms(normalizedKeyword).find((form) =>
        normalizedDescription.includes(` ${form} `),
      );

      if (!matchedForm) {
        continue;
      }

      const score =
        matchedForm.split(" ").length * 100 + matchedForm.length;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { category, score };
      }
    }
  }

  return bestMatch?.category ?? "Other";
}

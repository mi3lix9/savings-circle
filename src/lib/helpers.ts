import { InlineKeyboard } from "grammy";
import { eq, and } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { type circleMonths, stocks, type circles } from "../db/schema";
import type { Database } from "./db";

const ARABIC_MONTH_NAMES: Record<string, string> = {
  January: "يناير",
  February: "فبراير",
  March: "مارس",
  April: "أبريل",
  May: "مايو",
  June: "يونيو",
  July: "يوليو",
  August: "أغسطس",
  September: "سبتمبر",
  October: "أكتوبر",
  November: "نوفمبر",
  December: "ديسمبر",
};

export type BilingualMonthName = {
  english: string;
  arabic: string;
};

export function getBilingualMonthName(monthName: string): BilingualMonthName {
  const trimmed = monthName.trim();
  if (!trimmed) {
    return { english: "", arabic: "" };
  }

  const [rawMonth, ...rest] = trimmed.split(" ");
  const normalizedMonth = rawMonth.replace(/[^A-Za-z]/g, "");
  const arabicMonth = ARABIC_MONTH_NAMES[normalizedMonth] || normalizedMonth || trimmed;
  const remainder = rest.join(" ").trim();
  const arabic = remainder ? `${arabicMonth} ${remainder}` : arabicMonth;

  return {
    english: trimmed,
    arabic,
  };
}

export function getLocalizedMonthName(monthName: string, locale?: string | null): string {
  const bilingual = getBilingualMonthName(monthName);
  if (!locale) return bilingual.english;
  const normalizedLocale = locale.toLowerCase();
  if (normalizedLocale.startsWith("ar")) {
    return bilingual.arabic;
  }
  return bilingual.english;
}

export function wrapForLocale(text: string, locale?: string | null): string {
  if (!locale) return text;
  const normalizedLocale = locale.toLowerCase();
  if (normalizedLocale.startsWith("ar")) {
    return `\u202B${text}\u202C`;
  }
  return text;
}

export type CircleMonthWithStocks = InferSelectModel<typeof circleMonths> & {
  stocks: InferSelectModel<typeof stocks>[];
};

export type MonthAvailability = {
  id: number;
  name: string;
  index: number;
  totalStocks: number;
  remainingStocks: number;
};

export function computeMonthAvailability(
  months: CircleMonthWithStocks[],
): MonthAvailability[] {
  return months
    .map((month) => {
      const taken = month.stocks?.reduce((sum, stock) => sum + stock.stockCount, 0) ?? 0;
      return {
        id: month.id,
        name: month.name,
        index: month.index,
        totalStocks: month.totalStocks,
        remainingStocks: Math.max(month.totalStocks - taken, 0),
      };
    })
    .sort((a, b) => a.index - b.index);
}

export function formatMonthLabel(month: MonthAvailability, locale?: string | null): string {
  const monthLabel = getLocalizedMonthName(month.name, locale);
  return `${monthLabel} · ${month.remainingStocks}`;
}

export function buildMonthKeyboard(
  months: MonthAvailability[],
  options?: {
    includeRandom?: boolean;
    includeFinish?: boolean;
    locale?: string;
  },
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  months.forEach((month, idx) => {
    keyboard.text(formatMonthLabel(month, options?.locale), `month:${month.id}`);
    if (idx % 2 === 1) {
      keyboard.row();
    }
  });

  if (options?.includeRandom) {
    keyboard.row();
    keyboard.text("🎲 Random Month", "random");
  }

  if (options?.includeFinish) {
    if (!options?.includeRandom) {
      keyboard.row();
    }
    keyboard.text("✅ Finish", "finish");
  }

  return keyboard;
}

export type UserTurn = {
  circleId: number;
  circleName: string;
  monthlyAmount: number;
  monthId: number;
  monthName: string;
  monthIndex: number;
  stockCount: number;
  payoutAmount: number;
  monthsUntil: number;
  status: "past" | "current" | "future";
};

export type UserTurnsResult = {
  totalMonthlyPayout: number;
  turns: UserTurn[];
};

/**
 * Get user's turns and payout information from all locked circles
 */
export async function getUserTurns(
  db: Database,
  userId: number,
): Promise<UserTurnsResult> {
  // Get all locked circles
  const lockedCircles = await db.query.circles.findMany({
    with: {
      circleMonths: true,
    },
  });

  if (lockedCircles.length === 0) {
    return {
      totalMonthlyPayout: 0,
      turns: [],
    };
  }

  // Get user's stocks from locked circles
  const userStocks = await db.query.stocks.findMany({
    where: eq(stocks.userId, userId),
    with: {
      circle: true,
      circleMonth: true,
    },
  });

  // Filter stocks to only locked circles
  const lockedCircleIds = new Set(lockedCircles.map((c) => c.id));
  const relevantStocks = userStocks.filter((s) => lockedCircleIds.has(s.circleId));

  if (relevantStocks.length === 0) {
    return {
      totalMonthlyPayout: 0,
      turns: [],
    };
  }

  const now = new Date();
  const turns: UserTurn[] = [];

  for (const stock of relevantStocks) {
    const circle = stock.circle;
    const month = stock.circleMonth;

    // Calculate current month index
    // startDate is stored as Unix timestamp (seconds), convert to Date
    let currentMonthIndex = 0;
    if (circle.startDate) {
      // Handle both Date objects and Unix timestamps (seconds)
      const startDate = circle.startDate instanceof Date
        ? circle.startDate
        : new Date(circle.startDate * 1000); // Convert seconds to milliseconds
      const monthsDiff =
        (now.getFullYear() - startDate.getFullYear()) * 12 +
        (now.getMonth() - startDate.getMonth());
      currentMonthIndex = Math.max(0, monthsDiff);
    }

    // Calculate months until this turn
    const monthsUntil = month.index - currentMonthIndex;

    // Determine status
    let status: "past" | "current" | "future";
    if (monthsUntil < 0) {
      status = "past";
    } else if (monthsUntil === 0) {
      status = "current";
    } else {
      status = "future";
    }

    // Calculate payout amount for this month
    const payoutAmount = stock.stockCount * circle.monthlyAmount;

    turns.push({
      circleId: circle.id,
      circleName: circle.name,
      monthlyAmount: circle.monthlyAmount,
      monthId: month.id,
      monthName: month.name,
      monthIndex: month.index,
      stockCount: stock.stockCount,
      payoutAmount,
      monthsUntil,
      status,
    });
  }

  // Sort by circle, then by month index
  turns.sort((a, b) => {
    if (a.circleId !== b.circleId) {
      return a.circleId - b.circleId;
    }
    return a.monthIndex - b.monthIndex;
  });

  // Calculate total monthly payout (sum of all payout amounts)
  const totalMonthlyPayout = turns.reduce((sum, turn) => sum + turn.payoutAmount, 0);

  return {
    totalMonthlyPayout,
    turns,
  };
}

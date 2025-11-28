import { InlineKeyboard } from "grammy";
import type { InferSelectModel } from "drizzle-orm";
import type { circleMonths, stocks } from "../db/schema";

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

export function formatMonthLabel(month: MonthAvailability): string {
  return `${month.name} (${month.remainingStocks} left)`;
}

export function buildMonthKeyboard(
  months: MonthAvailability[],
  options?: {
    includeRandom?: boolean;
    includeFinish?: boolean;
  },
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  months.forEach((month, idx) => {
    keyboard.text(formatMonthLabel(month), `month:${month.id}`);
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

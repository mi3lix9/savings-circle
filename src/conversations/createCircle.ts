import { eq } from "drizzle-orm";
import { circleMonths, circles } from "../db/schema";
import type { MyContext, MyConversation } from "../lib/context";
import { requireAdmin } from "../lib/users";

type MonthConfig = {
  name: string;
  totalStocks: number;
};

export async function createCircleConversation(
  conversation: MyConversation,
  ctx: MyContext,
) {
  const admin = await requireAdmin(ctx);
  if (!admin) {
    await ctx.reply(ctx.t("errors-only-admins-create"));
    return;
  }

  const existingCircle = await ctx.db.query.circles.findFirst({
    where: eq(circles.isLocked, false),
  });
  if (existingCircle) {
    await ctx.reply(
      ctx.t("errors-circle-still-open", { circleName: existingCircle.name }),
    );
    return;
  }

  await ctx.reply(ctx.t("circle-what-name"));
  const circleName = await waitForText(conversation, ctx.t("circle-name-empty"));

  await ctx.reply(ctx.t("circle-monthly-amount"));
  const monthlyAmount = await waitForPositiveNumber(
    conversation,
    ctx.t("circle-monthly-amount-invalid"),
  );

  await ctx.reply(ctx.t("circle-duration"));
  const duration = await waitForInteger(
    conversation,
    ctx.t("circle-duration-invalid"),
    { min: 1, max: 24 },
  );

  await ctx.reply(ctx.t("circle-stocks-per-month"));
  const stocksPerMonth = await waitForInteger(
    conversation,
    ctx.t("circle-stocks-per-month-invalid"),
    { min: 1 },
  );

  await ctx.reply(ctx.t("circle-start-month"));
  const startMonth = await waitForInteger(
    conversation,
    ctx.t("circle-start-month-invalid"),
    { min: 1, max: 12 },
  );

  const currentYear = new Date().getFullYear();
  await ctx.reply(ctx.t("circle-start-year", { year: currentYear }));
  const startYear = await waitForInteger(
    conversation,
    ctx.t("circle-start-year-invalid", { year: currentYear }),
    { min: currentYear },
  );

  const months = generateMonths(startMonth, startYear, duration, stocksPerMonth);

  const [newCircle] = await ctx.db
    .insert(circles as any)
    .values({
      name: circleName,
      monthlyAmount,
      isLocked: false,
    })
    .returning();

  if (!newCircle) {
    await ctx.reply(ctx.t("errors-circle-creation-failed"));
    return;
  }

  const monthRows = months.map((month, index) => ({
    circleId: newCircle.id,
    name: month.name,
    index: index + 1,
    totalStocks: month.totalStocks,
  }));

  await ctx.db.insert(circleMonths as any).values(monthRows);

  // Calculate payment details
  const totalPerMonth = monthlyAmount * stocksPerMonth;
  const totalPayout = monthlyAmount * stocksPerMonth * duration;

  const summaryLines = months.map(
    (month, idx) => ctx.t("circle-month-summary", { index: idx + 1, monthName: month.name, stockCount: month.totalStocks }),
  );

  let message = ctx.t("circle-created", { circleName: newCircle.name }) + "\n\n";
  message += ctx.t("circle-payment-details") + "\n";
  message += ctx.t("circle-monthly-contribution", { amount: monthlyAmount }) + "\n";
  message += ctx.t("circle-total-collected", { totalPerMonth: totalPerMonth.toFixed(2) }) + "\n";
  message += ctx.t("circle-total-payout", { totalPayout: totalPayout.toFixed(2) }) + "\n\n";
  message += ctx.t("circle-months-title", { duration }) + "\n";
  message += summaryLines.join("\n") + "\n\n";
  message += ctx.t("circle-use-start-circle");

  await ctx.reply(message);
}

async function waitForText(
  conversation: MyConversation,
  invalidMessage: string,
): Promise<string> {
  while (true) {
    const answerCtx = await conversation.waitFor("message:text");
    const text = answerCtx.message?.text?.trim();
    if (text) {
      return text;
    }
    await answerCtx.reply(invalidMessage);
  }
}

async function waitForPositiveNumber(
  conversation: MyConversation,
  invalidMessage: string,
): Promise<number> {
  while (true) {
    const answerCtx = await conversation.waitFor("message:text");
    const rawText = answerCtx.message?.text?.trim() ?? "";
    const value = Number(rawText.replace(/[^0-9.]/g, ""));
    if (!Number.isNaN(value) && value > 0) {
      return Math.round(value * 100) / 100;
    }
    await answerCtx.reply(invalidMessage);
  }
}

async function waitForInteger(
  conversation: MyConversation,
  invalidMessage: string,
  options?: { min?: number; max?: number },
): Promise<number> {
  while (true) {
    const answerCtx = await conversation.waitFor("message:text");
    const rawText = answerCtx.message?.text?.trim() ?? "";
    const value = Number(rawText.replace(/[^0-9]/g, ""));
    if (
      Number.isInteger(value) &&
      value > 0 &&
      (!options?.min || value >= options.min) &&
      (!options?.max || value <= options.max)
    ) {
      return value;
    }
    await answerCtx.reply(invalidMessage);
  }
}

function generateMonths(
  startMonth: number,
  startYear: number,
  duration: number,
  stocksPerMonth: number,
): MonthConfig[] {
  const months: MonthConfig[] = [];
  const date = new Date(startYear, startMonth - 1, 1); // Month is 0-indexed in Date

  for (let i = 0; i < duration; i++) {
    const monthName = date.toLocaleString("en-US", { month: "long", year: "numeric" });
    months.push({
      name: monthName,
      totalStocks: stocksPerMonth,
    });
    // Move to next month (handles year rollover automatically)
    date.setMonth(date.getMonth() + 1);
  }

  return months;
}

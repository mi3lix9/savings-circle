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
    await ctx.reply("Only admins can create a circle.");
    return;
  }

  const existingCircle = await ctx.db.query.circles.findFirst({
    where: eq(circles.isLocked, false),
  });
  if (existingCircle) {
    await ctx.reply(
      `Circle "${existingCircle.name}" is still open. Lock it with /start_circle before creating a new one.`,
    );
    return;
  }

  await ctx.reply("Let's create a new circle. What should the circle be called?");
  const circleName = await waitForText(conversation, "Circle name cannot be empty.");

  await ctx.reply("Enter the monthly contribution amount (numbers only).");
  const monthlyAmount = await waitForPositiveNumber(
    conversation,
    "Please enter a positive number for the monthly amount.",
  );

  await ctx.reply("How many months should this circle run? (Enter a number between 1 and 24)");
  const duration = await waitForInteger(
    conversation,
    "Please enter a number between 1 and 24 for the duration.",
    { min: 1, max: 24 },
  );

  await ctx.reply("How many stocks should be available per month?");
  const stocksPerMonth = await waitForInteger(
    conversation,
    "Please enter a positive number for stocks per month.",
    { min: 1 },
  );

  await ctx.reply("What month should the circle start? (Enter a number from 1-12, where 1=January, 12=December)");
  const startMonth = await waitForInteger(
    conversation,
    "Please enter a number between 1 and 12 for the start month.",
    { min: 1, max: 12 },
  );

  const currentYear = new Date().getFullYear();
  await ctx.reply(`What year should the circle start? (Enter a year, e.g., ${currentYear})`);
  const startYear = await waitForInteger(
    conversation,
    `Please enter a valid year (${currentYear} or later).`,
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
    await ctx.reply("Something went wrong while creating the circle. Please try again.");
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
    (month, idx) => `${idx + 1}. ${month.name} — ${month.totalStocks} stock(s)`,
  );

  const message = `Circle "${newCircle.name}" created!

📊 Payment Details:
• Monthly contribution per participant: ${monthlyAmount} SAR
• Total collected per month: ${totalPerMonth.toFixed(2)} SAR
• Total payout for circle: ${totalPayout.toFixed(2)} SAR

📅 Months (${duration} months):
${summaryLines.join("\n")}

Use /start_circle once subscriptions should be locked.`;

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

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

  await ctx.reply(
    "Send the payout months in order using the format `Month:stocks`, separated by commas or new lines.\nExample: `January:10, February:12, March:10`",
  );
  const months = await waitForMonths(conversation);

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

  const summaryLines = months.map(
    (month, idx) => `${idx + 1}. ${month.name} — ${month.totalStocks} stock(s)`,
  );

  await ctx.reply(
    `Circle "${newCircle.name}" created with a monthly amount of ${monthlyAmount}.\n\n${summaryLines.join(
      "\n",
    )}\n\nUse /start_circle once subscriptions should be locked.`,
  );
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

async function waitForMonths(
  conversation: MyConversation,
): Promise<MonthConfig[]> {
  while (true) {
    const answerCtx = await conversation.waitFor("message:text");
    const text = answerCtx.message?.text ?? "";
    const months = parseMonthInput(text);
    if (months.length > 0) {
      return months;
    }
    await answerCtx.reply(
      "Couldn't parse that. Use `Month:stocks` pairs separated by commas. Example: `January:10, February:8`",
    );
  }
}

function parseMonthInput(raw: string): MonthConfig[] {
  const sections = raw
    .split(/[,\\n]+/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length === 0) {
    return [];
  }

  const months: MonthConfig[] = [];

  for (const section of sections) {
    const [namePart, stockPart] = section.split(":").map((part) => part.trim());
    if (!namePart || !stockPart) {
      return [];
    }

    const stockValue = Number(stockPart);
    if (!Number.isInteger(stockValue) || stockValue <= 0) {
      return [];
    }

    months.push({
      name: namePart,
      totalStocks: stockValue,
    });
  }

  return months;
}

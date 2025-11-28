import type { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard } from "grammy";
import { eq } from "drizzle-orm";
import { circleMonths, circles, stocks } from "../db/schema";
import type { MyContext, MyContext } from "../lib/context";
import {
  buildMonthKeyboard,
  computeMonthAvailability,
  type MonthAvailability,
} from "../lib/helpers";
import { findOrCreateUser } from "../lib/users";

const confirmationKeyboard = new InlineKeyboard()
  .text("✅ Confirm", "confirm")
  .text("↩️ Cancel", "cancel");

const continueKeyboard = new InlineKeyboard()
  .text("➕ Add Another Month", "continue:more")
  .text("✅ Finish", "continue:done");

export async function subscribeConversation(
  conversation: Conversation<MyContext, MyContext>,
  ctx: MyContext,
) {
  if (!ctx.from) {
    await ctx.reply("I need your Telegram profile to get started.");
    return;
  }

  const user = await findOrCreateUser(ctx);
  const activeCircle = await ctx.db.query.circles.findFirst({
    where: eq(circles.isLocked, false),
  });

  if (!activeCircle) {
    await ctx.reply("There is no active savings circle right now. Please try again later.");
    return;
  }

  await ctx.reply(
    `Welcome! Each stock for ${activeCircle.name} costs ${activeCircle.monthlyAmount}. Let's pick your months.`,
  );

  const summary: { monthName: string; stockCount: number; amount: number }[] = [];

  while (true) {
    const months = await ctx.db.query.circleMonths.findMany({
      where: eq(circleMonths.circleId, activeCircle.id),
      with: { stocks: true },
    });

    const availability = computeMonthAvailability(months);
    const selectableMonths = availability.filter((month) => month.remainingStocks > 0);

    if (selectableMonths.length === 0) {
      await ctx.reply("All months are fully subscribed. Thank you for checking in!");
      break;
    }

    await ctx.reply("Select a month to subscribe:", {
      reply_markup: buildMonthKeyboard(selectableMonths, { includeRandom: true, includeFinish: true }),
    });

    const monthSelection = await waitForMonthSelection(
      conversation,
      selectableMonths,
    );
    if (monthSelection.finished) {
      break;
    }
    const chosenMonth = monthSelection.month;
    if (!chosenMonth) {
      continue;
    }

    await ctx.reply(
      `There are ${chosenMonth.remainingStocks} stock(s) available in ${chosenMonth.name}. How many would you like?`,
      { reply_markup: buildStockKeyboard(chosenMonth.remainingStocks) },
    );

    const stockCount = await waitForStockCount(
      conversation,
      chosenMonth.remainingStocks,
    );
    if (!stockCount) {
      await ctx.reply("No stock count was selected. Let's start over.");
      continue;
    }

    const totalAmount = Number((stockCount * activeCircle.monthlyAmount).toFixed(2));

    await ctx.reply(
      `You chose ${stockCount} stock(s) for ${chosenMonth.name}.\nEstimated total: ${totalAmount}.\nConfirm to save this subscription.`,
      { reply_markup: confirmationKeyboard },
    );

    const confirmed = await waitForConfirmation(conversation);
    if (!confirmed) {
      await ctx.reply("Okay, that selection was cancelled. Let's try again.");
      continue;
    }

    const latestMonth = await ctx.db.query.circleMonths.findFirst({
      where: eq(circleMonths.id, chosenMonth.id),
      with: { stocks: true },
    });

    if (!latestMonth) {
      await ctx.reply("The selected month is no longer available. Please pick a different one.");
      continue;
    }

    const [freshAvailability] = computeMonthAvailability([latestMonth]);
    if (!freshAvailability || freshAvailability.remainingStocks < stockCount) {
      await ctx.reply("Not enough stocks remain for that month. Please pick another option.");
      continue;
    }

    await ctx.db.insert(stocks as any).values({
      circleId: activeCircle.id,
      userId: user.id,
      monthId: chosenMonth.id,
      stockCount,
    });

    summary.push({
      monthName: chosenMonth.name,
      stockCount,
      amount: totalAmount,
    });

    const shouldContinue = await askToContinue(conversation, ctx);
    if (!shouldContinue) {
      break;
    }
  }

  if (summary.length === 0) {
    await ctx.reply("No subscriptions were created. Use /subscribe again anytime.");
    return;
  }

  const totalStocks = summary.reduce((sum, item) => sum + item.stockCount, 0);
  const totalAmount = summary.reduce((sum, item) => sum + item.amount, 0);
  const lines = summary.map(
    (item, idx) => `${idx + 1}. ${item.monthName} — ${item.stockCount} stock(s)`,
  );
  lines.push(`Total stocks: ${totalStocks}`);
  lines.push(`Estimated total: ${totalAmount}`);

  await ctx.reply(`Success! Here is your summary:\n${lines.join("\n")}`);
}

async function waitForMonthSelection(
  conversation: Conversation<MyContext, MyContext>,
  months: MonthAvailability[],
): Promise<{ finished: boolean; month?: MonthAvailability }> {
  while (true) {
    const selectionCtx = await conversation.waitFor("callback_query:data");
    const data = selectionCtx.callbackQuery?.data ?? "";
    await selectionCtx.answerCallbackQuery();

    if (data === "finish") {
      return { finished: true };
    }

    if (data === "random") {
      const randomMonth = months[Math.floor(Math.random() * months.length)];
      if (!randomMonth) {
        await selectionCtx.reply("No months are available right now. Please try again.");
        continue;
      }
      await selectionCtx.reply(`Randomly selected ${randomMonth.name}.`);
      return { finished: false, month: randomMonth };
    }

    if (data.startsWith("month:")) {
      const monthId = Number(data.split(":")[1]);
      const month = months.find((entry) => entry.id === monthId);
      if (!month) {
        await selectionCtx.reply("That month is no longer available. Please choose another option.");
        continue;
      }
      return { finished: false, month };
    }

    await selectionCtx.reply("Please pick one of the provided month options.");
  }
}

function buildStockKeyboard(max: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const limit = Math.min(max, 8);

  for (let i = 1; i <= limit; i++) {
    keyboard.text(String(i), `stock:${i}`);
    if (i % 4 === 0 && i !== limit) {
      keyboard.row();
    }
  }

  if (max > limit) {
    keyboard.row();
    keyboard.text("Other", "stock:other");
  }

  return keyboard;
}

async function waitForStockCount(
  conversation: Conversation<MyContext, MyContext>,
  max: number,
): Promise<number | null> {
  while (true) {
    const nextCtx = await conversation.wait();

    if (nextCtx.callbackQuery?.data?.startsWith("stock:")) {
      const value = nextCtx.callbackQuery.data.split(":")[1];
      await nextCtx.answerCallbackQuery();
      if (value === "other") {
        await nextCtx.reply(`Send a number between 1 and ${max}.`);
        continue;
      }
      const num = Number(value);
      if (Number.isInteger(num) && num >= 1 && num <= max) {
        return num;
      }
      await nextCtx.reply(`Please pick a value between 1 and ${max}.`);
      continue;
    }

    if (nextCtx.message?.text) {
      const num = Number(nextCtx.message.text.trim());
      if (Number.isInteger(num) && num >= 1 && num <= max) {
        return num;
      }
      await nextCtx.reply(`Please send a whole number between 1 and ${max}.`);
      continue;
    }

    await nextCtx.reply("Use the buttons or send a number to continue.");
  }
}

async function waitForConfirmation(
  conversation: Conversation<MyContext, MyContext>,
): Promise<boolean> {
  while (true) {
    const confirmCtx = await conversation.waitFor("callback_query:data");
    const data = confirmCtx.callbackQuery?.data;
    await confirmCtx.answerCallbackQuery();

    if (data === "confirm") {
      return true;
    }
    if (data === "cancel") {
      return false;
    }

    await confirmCtx.reply("Please use the buttons to confirm or cancel.");
  }
}

async function askToContinue(
  conversation: Conversation<MyContext, MyContext>,
  ctx: MyContext,
): Promise<boolean> {
  await ctx.reply("Would you like to subscribe to another month?", {
    reply_markup: continueKeyboard,
  });

  while (true) {
    const decisionCtx = await conversation.waitFor("callback_query:data");
    const data = decisionCtx.callbackQuery?.data;
    await decisionCtx.answerCallbackQuery();

    if (data === "continue:more") {
      return true;
    }
    if (data === "continue:done") {
      return false;
    }

    await decisionCtx.reply("Please use the buttons to continue or finish.");
  }
}

import { InlineKeyboard } from "grammy";
import { eq } from "drizzle-orm";
import { circleMonths, circles, stocks } from "../db/schema";
import type { MyContext, MyConversation } from "../lib/context";
import {
  computeMonthAvailability,
  type MonthAvailability,
} from "../lib/helpers";

type SubscribeState = {
  monthId?: number;
  stockCount: number;
};

export async function subscribeConversation(
  conversation: MyConversation,
  ctx: MyContext,
) {
  if (!ctx.from) {
    await ctx.reply("I need your Telegram profile to get started.");
    return;
  }

  const user = ctx.user;
  const activeCircle = await ctx.db.query.circles.findFirst({
    where: eq(circles.isLocked, false),
  });

  if (!activeCircle) {
    await ctx.reply("There is no active savings circle right now. Please try again later.");
    return;
  }

  // Initial state
  const state: SubscribeState = {
    stockCount: 1,
  };

  let messageId: number | undefined;

  while (true) {
    // 1. Fetch fresh data
    const months = await ctx.db.query.circleMonths.findMany({
      where: eq(circleMonths.circleId, activeCircle.id),
      with: { stocks: true },
    });

    const availability = computeMonthAvailability(months);
    const selectableMonths = availability.filter((m) => m.remainingStocks > 0);
    
    // If a month is selected, ensure it's still valid
    let selectedMonth: MonthAvailability | undefined;
    if (state.monthId) {
      selectedMonth = selectableMonths.find((m) => m.id === state.monthId);
      if (!selectedMonth) {
        // Reset if selected month became unavailable or invalid
        state.monthId = undefined;
        state.stockCount = 1;
      }
    }

    // 2. Build Message Text
    const totalCircleCapacity = months.reduce((sum, m) => sum + m.totalStocks, 0);
    const payMonthly = state.stockCount * activeCircle.monthlyAmount;
    // Receive Monthly = Stock Count * (Total Circle Capacity * Monthly Amount)
    // Assumption: "Receive Monthly" means the total payout the user gets when it's their turn.
    const receiveMonthly = state.stockCount * (totalCircleCapacity * activeCircle.monthlyAmount);

    let text = `<b>${activeCircle.name}</b>\n`;
    text += `Stock Cost: ${activeCircle.monthlyAmount} SAR\n\n`;

    if (selectedMonth) {
      text += `📅 <b>Month:</b> ${selectedMonth.name}\n`;
      text += `🔢 <b>Stocks:</b> ${state.stockCount}\n`;
      text += `💸 <b>Pay Monthly:</b> ${payMonthly.toFixed(2)} SAR\n`;
      text += `💰 <b>Receive Monthly:</b> ${receiveMonthly.toFixed(2)} SAR\n`;
      text += `\n<i>Confirm your subscription below.</i>`;
    } else {
      text += `Please select a month to view details and subscribe.`;
    }

    // 3. Build Keyboard
    const keyboard = new InlineKeyboard();

    if (!selectedMonth) {
      // Month Selection Mode
      selectableMonths.forEach((month, idx) => {
        keyboard.text(`${month.name} (${month.remainingStocks})`, `select_month:${month.id}`);
        if (idx % 2 === 1) keyboard.row();
      });
      if (selectableMonths.length === 0) {
        text += "\n\n⚠️ No months available.";
      }
      keyboard.row().text("❌ Cancel", "cancel");
    } else {
      // Detail/Edit Mode
      // Stock controls
      const maxStocks = selectedMonth.remainingStocks;
      
      keyboard.text("➖", "stock:dec");
      keyboard.text(`${state.stockCount}`, "noop");
      keyboard.text("➕", "stock:inc");
      keyboard.row();
      
      keyboard.text("🔙 Change Month", "back_to_months");
      keyboard.row();
      
      keyboard.text("✅ Confirm Subscription", "confirm");
      keyboard.row();
      keyboard.text("❌ Cancel", "cancel");
    }

    // 4. Send or Edit Message
    if (messageId) {
      try {
        await ctx.api.editMessageText(ctx.chat!.id, messageId, text, {
          parse_mode: "HTML",
          reply_markup: keyboard,
        });
      } catch (e) {
        // Ignore "message is not modified" errors
      }
    } else {
      const msg = await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
      messageId = msg.message_id;
    }

    // 5. Wait for Action
    const update = await conversation.waitFor("callback_query:data");
    const data = update.callbackQuery.data;
    await update.answerCallbackQuery();

    // 6. Handle Actions
    if (data === "cancel") {
      await ctx.api.deleteMessage(ctx.chat!.id, messageId!);
      await ctx.reply("Subscription cancelled.");
      return;
    }

    if (data.startsWith("select_month:")) {
      const monthId = Number(data.split(":")[1]);
      state.monthId = monthId;
      state.stockCount = 1; // Reset stock count on new month selection
    }

    if (data === "back_to_months") {
      state.monthId = undefined;
    }

    if (data === "stock:inc") {
      if (selectedMonth && state.stockCount < selectedMonth.remainingStocks) {
        state.stockCount++;
      }
    }

    if (data === "stock:dec") {
      if (state.stockCount > 1) {
        state.stockCount--;
      }
    }

    if (data === "confirm") {
      if (!selectedMonth) continue;

      // Final validation
      const latestMonth = await ctx.db.query.circleMonths.findFirst({
        where: eq(circleMonths.id, selectedMonth.id),
        with: { stocks: true },
      });

      if (!latestMonth) {
        await ctx.reply("Selected month is no longer available.");
        state.monthId = undefined;
        continue;
      }

      const [freshAvailability] = computeMonthAvailability([latestMonth]);
      if (!freshAvailability || freshAvailability.remainingStocks < state.stockCount) {
        await ctx.reply("Not enough stocks remaining. Please adjust.");
        continue;
      }

      // Save to DB
      await ctx.db.insert(stocks as any).values({
        circleId: activeCircle.id,
        userId: user.id,
        monthId: selectedMonth.id,
        stockCount: state.stockCount,
        status: "confirmed", // Auto-confirm for now as per previous flow logic
      });

      await ctx.api.deleteMessage(ctx.chat!.id, messageId!);
      await ctx.reply(
        `✅ <b>Subscribed!</b>\n\n` +
        `Circle: ${activeCircle.name}\n` +
        `Month: ${selectedMonth.name}\n` +
        `Stocks: ${state.stockCount}\n` +
        `Pay Monthly: ${payMonthly.toFixed(2)} SAR\n` +
        `Receive: ${receiveMonthly.toFixed(2)} SAR`,
        { parse_mode: "HTML" }
      );
      return;
    }
  }
}

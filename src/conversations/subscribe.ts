import { InlineKeyboard } from "grammy";
import { eq, and } from "drizzle-orm";
import { circleMonths, circles, stocks } from "../db/schema";
import type { MyContext, MyConversation } from "../lib/context";
import {
  computeMonthAvailability,
  type MonthAvailability,
} from "../lib/helpers";

type CartItem = {
  monthId: number;
  monthName: string;
  stockCount: number;
};

type SubscribeState = {
  monthId?: number;
  stockCount: number;
  cart: CartItem[];
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
    cart: [],
  };

  // Pre-load existing stocks
  const existingStocks = await ctx.db.query.stocks.findMany({
    where: and(
      eq(stocks.circleId, activeCircle.id),
      eq(stocks.userId, user.id)
    ),
    with: { circleMonth: true },
  });

  if (existingStocks.length > 0) {
    state.cart = existingStocks.map((s) => ({
      monthId: s.monthId,
      monthName: s.circleMonth.name,
      stockCount: s.stockCount,
    }));
  }

  let messageId: number | undefined;

  while (true) {
    // 1. Fetch fresh data
    const months = await ctx.db.query.circleMonths.findMany({
      where: eq(circleMonths.circleId, activeCircle.id),
      with: { stocks: true },
    });

    const availability = computeMonthAvailability(months);
    
    // Adjust availability to include the user's current stocks (since they can re-use them)
    const adjustedAvailability = availability.map(m => {
      const monthData = months.find(x => x.id === m.id);
      const myStocks = monthData?.stocks
        .filter(s => s.userId === user.id)
        .reduce((sum, s) => sum + s.stockCount, 0) || 0;
      
      return {
        ...m,
        remainingStocks: m.remainingStocks + myStocks
      };
    });

    const selectableMonths = adjustedAvailability.filter((m) => m.remainingStocks > 0);

    // If a month is selected, ensure it's still valid
    let selectedMonth: MonthAvailability | undefined;
    if (state.monthId) {
      selectedMonth = selectableMonths.find((m) => m.id === state.monthId);
      if (!selectedMonth) {
        state.monthId = undefined;
        state.stockCount = 1;
      }
    }

    // 2. Build Message Text
    const numberOfMonths = months.length;

    let text = `<b>${activeCircle.name}</b>\n`;
    text += `Stock Cost: ${activeCircle.monthlyAmount} SAR\n\n`;

    // Show Cart Summary if items exist
    if (state.cart.length > 0 && !selectedMonth) {
      text += `🛒 <b>Your Selections:</b>\n`;
      let cartTotalStocks = 0;
      state.cart.forEach((item, idx) => {
        text += `${idx + 1}. ${item.monthName}: ${item.stockCount} stock(s)\n`;
        cartTotalStocks += item.stockCount;
      });

      const cartPayMonthly = cartTotalStocks * activeCircle.monthlyAmount;
      const cartReceiveMonthly = cartTotalStocks * activeCircle.monthlyAmount * numberOfMonths;

      text += `\n<b>Total Pay Monthly:</b> ${cartPayMonthly.toFixed(2)} SAR`;
      text += `\n<b>Total Receive:</b> ${cartReceiveMonthly.toFixed(2)} SAR\n\n`;
    }

    if (selectedMonth) {
      // Editing/Adding a specific month
      const payMonthly = state.stockCount * activeCircle.monthlyAmount;
      const receiveMonthly = state.stockCount * activeCircle.monthlyAmount * numberOfMonths;

      text += `📅 <b>Month:</b> ${selectedMonth.name}\n`;
      text += `🔢 <b>Stocks:</b> ${state.stockCount}\n`;
      text += `💸 <b>Pay Monthly:</b> ${payMonthly.toFixed(2)} SAR\n`;
      text += `💰 <b>Receive Monthly:</b> ${receiveMonthly.toFixed(2)} SAR\n`;
      text += `\n<i>Adjust stocks and add to your cart.</i>`;
    } else {
      text += `Select a month to add to your subscription.`;
    }

    // 3. Build Keyboard
    const keyboard = new InlineKeyboard();

    if (!selectedMonth) {
      // Month Selection Mode
      selectableMonths.forEach((month, idx) => {
        // Check if already in cart
        const inCart = state.cart.find(c => c.monthId === month.id);
        const label = inCart
          ? `${month.name} (In Cart: ${inCart.stockCount})`
          : `${month.name} (${month.remainingStocks})`;

        keyboard.text(label, `select_month:${month.id}`);
        if (idx % 2 === 1) keyboard.row();
      });

      if (selectableMonths.length === 0) {
        text += "\n\n⚠️ No months available.";
      }

      keyboard.row();

      if (state.cart.length > 0) {
        keyboard.text("✅ Checkout / Confirm", "checkout");
        keyboard.text("🗑 Clear Cart", "clear_cart");
        keyboard.row();
      }

      keyboard.text("❌ Cancel", "cancel");
    } else {
      // Detail/Edit Mode
      const maxStocks = selectedMonth.remainingStocks;

      keyboard.text("➖", "stock:dec");
      keyboard.text(`${state.stockCount}`, "noop");
      keyboard.text("➕", "stock:inc");
      keyboard.row();

      keyboard.text("📥 Add to Cart", "add_to_cart");
      keyboard.row();

      keyboard.text("🔙 Back", "back_to_months");
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
      // If already in cart, pre-fill stock count? Or just start at 1?
      // Let's start at 1 for simplicity, or maybe 1 + existing?
      // For now, simple: start at 1. If they add again, it updates the cart item.
      const existingItem = state.cart.find(c => c.monthId === monthId);
      state.stockCount = existingItem ? existingItem.stockCount : 1;
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

    if (data === "clear_cart") {
      state.cart = [];
    }

    if (data === "add_to_cart") {
      const currentMonth = selectedMonth;
      if (currentMonth) {
        // Update or Add to cart
        const existingIdx = state.cart.findIndex(c => c.monthId === currentMonth.id);
        if (existingIdx >= 0) {
          state.cart[existingIdx].stockCount = state.stockCount;
        } else {
          state.cart.push({
            monthId: currentMonth.id,
            monthName: currentMonth.name,
            stockCount: state.stockCount
          });
        }
        state.monthId = undefined; // Go back to list
      }
    }

    if (data === "checkout") {
      if (state.cart.length === 0) continue;

      // Final validation for ALL items
      let allValid = true;

      // We need to re-fetch to be sure
      const latestMonths = await ctx.db.query.circleMonths.findMany({
        where: eq(circleMonths.circleId, activeCircle.id),
        with: { stocks: true },
      });
      const latestAvailability = computeMonthAvailability(latestMonths);

      for (const item of state.cart) {
        const monthData = latestMonths.find(m => m.id === item.monthId);
        if (!monthData) {
             await ctx.reply(`Issue with ${item.monthName}: Month not found.`);
             allValid = false;
             break;
        }

        // Calculate availability manually to account for user's existing stocks
        const totalStocks = monthData.totalStocks;
        const takenStocks = monthData.stocks.reduce((sum, s) => sum + s.stockCount, 0);
        const myExistingStocks = monthData.stocks
            .filter(s => s.userId === user.id)
            .reduce((sum, s) => sum + s.stockCount, 0);
        
        const trueRemaining = totalStocks - takenStocks;
        // The stocks available to THIS user is the general remaining + what they currently hold (since they are replacing it)
        const availableForUser = trueRemaining + myExistingStocks;

        if (availableForUser < item.stockCount) {
          await ctx.reply(`Issue with ${item.monthName}: Not enough stocks. You requested ${item.stockCount}, but only ${availableForUser} are available.`);
          allValid = false;
          break;
        }
      }

      if (!allValid) {
        // Stay in loop, user can adjust
        continue;
      }

      // Save to DB (Transaction: Delete old -> Insert new)
      await ctx.db.transaction(async (tx) => {
        // 1. Delete existing stocks for this user in this circle
        await tx.delete(stocks)
          .where(and(
            eq(stocks.circleId, activeCircle.id),
            eq(stocks.userId, user.id)
          ));

        // 2. Insert new stocks
        for (const item of state.cart) {
          await tx.insert(stocks as any).values({
            circleId: activeCircle.id,
            userId: user.id,
            monthId: item.monthId,
            stockCount: item.stockCount,
            status: "confirmed",
          });
        }
      });

      await ctx.api.deleteMessage(ctx.chat!.id, messageId!);

      // Get number of months for the calculation
      const numberOfMonths = latestMonths.length;

      let summaryText = `✅ <b>Subscribed Successfully!</b>\n\n`;
      let totalPay = 0;
      let totalReceive = 0;

      state.cart.forEach(item => {
        const pay = item.stockCount * activeCircle.monthlyAmount;
        const receive = item.stockCount * activeCircle.monthlyAmount * numberOfMonths;
        summaryText += `• <b>${item.monthName}</b>: ${item.stockCount} stocks\n`;
        totalPay += pay;
        totalReceive += receive;
      });

      summaryText += `\n<b>Total Pay Monthly:</b> ${totalPay.toFixed(2)} SAR`;
      summaryText += `\n<b>Total Receive:</b> ${totalReceive.toFixed(2)} SAR`;

      await ctx.reply(summaryText, { parse_mode: "HTML" });
      return;
    }
  }
}

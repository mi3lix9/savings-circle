import { InlineKeyboard } from "grammy";
import { eq, and } from "drizzle-orm";
import { circleMonths, circles, stocks } from "../db/schema";
import type { MyContext, MyConversation } from "../lib/context";
import {
  computeMonthAvailability,
  getLocalizedMonthName,
  wrapForLocale,
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
    await ctx.reply(ctx.t("errors-missing-telegram-profile"));
    return;
  }

  const user = ctx.user;
  const activeCircle = await ctx.db.query.circles.findFirst({
    where: eq(circles.isLocked, false),
  });

  if (!activeCircle) {
    await ctx.reply(ctx.t("errors-no-active-circle"));
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
    const locale = await ctx.i18n.getLocale();
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

    let text = ctx.t("subscribe-circle-name", { circleName: activeCircle.name }) + "\n";
    text += ctx.t("subscribe-stock-cost", { amount: activeCircle.monthlyAmount }) + "\n\n";

    // Show Cart Summary if items exist
    if (state.cart.length > 0 && !selectedMonth) {
      text += ctx.t("subscribe-cart-title") + "\n";
      let cartTotalStocks = 0;
      state.cart.forEach((item, idx) => {
        const localizedMonth = getLocalizedMonthName(item.monthName, locale);
        text += ctx.t("subscribe-cart-item", { index: idx + 1, monthName: localizedMonth, stockCount: item.stockCount }) + "\n";
        cartTotalStocks += item.stockCount;
      });

      const cartPayMonthly = cartTotalStocks * activeCircle.monthlyAmount;
      const cartReceiveMonthly = cartTotalStocks * activeCircle.monthlyAmount * numberOfMonths;

      text += "\n" + ctx.t("subscribe-total-pay-monthly", { amount: cartPayMonthly.toFixed(2) });
      text += "\n" + ctx.t("subscribe-total-receive", { amount: cartReceiveMonthly.toFixed(2) }) + "\n\n";
    }

    if (selectedMonth) {
      // Editing/Adding a specific month
      const payMonthly = state.stockCount * activeCircle.monthlyAmount;
      const receiveMonthly = state.stockCount * activeCircle.monthlyAmount * numberOfMonths;

      const localizedMonth = getLocalizedMonthName(selectedMonth.name, locale);
      text += ctx.t("subscribe-month-detail", { monthName: localizedMonth }) + "\n";
      text += ctx.t("subscribe-stocks-detail", { stockCount: state.stockCount }) + "\n";
      text += ctx.t("subscribe-pay-monthly", { amount: payMonthly.toFixed(2) }) + "\n";
      text += ctx.t("subscribe-receive-monthly", { amount: receiveMonthly.toFixed(2) }) + "\n";
      text += "\n" + ctx.t("subscribe-adjust-stocks");
    } else {
      text += ctx.t("subscribe-select-month");
    }

    // 3. Build Keyboard
    const keyboard = new InlineKeyboard();

    if (!selectedMonth) {
      // Month Selection Mode
      selectableMonths.forEach((month, idx) => {
        // Check if already in cart
        const inCart = state.cart.find(c => c.monthId === month.id);
        const localizedMonth = getLocalizedMonthName(month.name, locale);
        const label = inCart
          ? ctx.t("subscribe-month-in-cart", { monthName: localizedMonth, stockCount: inCart.stockCount })
          : ctx.t("subscribe-month-label", { monthName: localizedMonth, remaining: month.remainingStocks });

        keyboard.text(label, `select_month:${month.id}`);
        if (idx % 2 === 1) keyboard.row();
      });

      if (selectableMonths.length === 0) {
        text += "\n\n" + ctx.t("subscribe-no-months-available");
      }

      keyboard.row();

      if (state.cart.length > 0) {
        keyboard.text(ctx.t("subscribe-checkout"), "checkout");
        keyboard.text(ctx.t("subscribe-clear-cart"), "clear_cart");
        keyboard.row();
      }

      keyboard.text(ctx.t("subscribe-cancel"), "cancel");
    } else {
      // Detail/Edit Mode
      const maxStocks = selectedMonth.remainingStocks;

      keyboard.text("➖", "stock:dec");
      keyboard.text(`${state.stockCount}`, "noop");
      keyboard.text("➕", "stock:inc");
      keyboard.row();

      keyboard.text(ctx.t("subscribe-add-to-cart"), "add_to_cart");
      keyboard.row();

      keyboard.text(ctx.t("subscribe-back"), "back_to_months");
    }

    // 4. Send or Edit Message
    const localizedText = wrapForLocale(text, locale);

    if (messageId) {
      try {
        await ctx.api.editMessageText(ctx.chat!.id, messageId, localizedText, {
          parse_mode: "HTML",
          reply_markup: keyboard,
        });
      } catch (e) {
        // Ignore "message is not modified" errors
      }
    } else {
      const msg = await ctx.reply(localizedText, {
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
      await ctx.reply(ctx.t("subscribe-cancelled"));
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
        if (existingIdx >= 0 && state.cart[existingIdx]) {
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
          const localizedName = getLocalizedMonthName(item.monthName, locale);
          await ctx.reply(wrapForLocale(ctx.t("errors-month-not-found", { monthName: localizedName }), locale));
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
          const localizedName = getLocalizedMonthName(item.monthName, locale);
          await ctx.reply(wrapForLocale(ctx.t("errors-not-enough-stocks", { monthName: localizedName, stockCount: item.stockCount, available: availableForUser }), locale));
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

      let summaryText = ctx.t("subscribe-success-title") + "\n\n";
      let totalPay = 0;
      let totalReceive = 0;

      state.cart.forEach(item => {
        const pay = item.stockCount * activeCircle.monthlyAmount;
        const receive = item.stockCount * activeCircle.monthlyAmount * numberOfMonths;
        const localizedMonth = getLocalizedMonthName(item.monthName, locale);
        summaryText += ctx.t("subscribe-success-item", { monthName: localizedMonth, stockCount: item.stockCount }) + "\n";
        totalPay += pay;
        totalReceive += receive;
      });

      summaryText += "\n" + ctx.t("subscribe-total-pay-monthly", { amount: totalPay.toFixed(2) });
      summaryText += "\n" + ctx.t("subscribe-total-receive", { amount: totalReceive.toFixed(2) });

      const locale = await ctx.i18n.getLocale();
      await ctx.reply(wrapForLocale(summaryText, locale), { parse_mode: "HTML" });
      return;
    }
  }
}

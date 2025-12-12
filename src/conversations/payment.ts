import { InlineKeyboard } from "grammy";
import { eq, and } from "drizzle-orm";
import { circles, payments, stocks } from "../db/schema";
import type { MyContext, MyConversation } from "../lib/context";
import { getLocalizedMonthName, wrapForLocale } from "../lib/helpers";
import { notifyAdminsOfPayment, generatePaymentReport } from "../lib/admin";

type PaymentState = {
  fileId?: string;
  selectedMonthIds: number[];
};

export async function paymentConversation(
  conversation: MyConversation,
  ctx: MyContext,
) {
  if (!ctx.from) {
    await ctx.reply(ctx.t("errors-missing-telegram-profile"));
    return;
  }

  const user = ctx.user;
  
  // Find active circle (locked = true means it's running)
  const activeCircle = await ctx.db.query.circles.findFirst({
    where: eq(circles.isLocked, true),
    with: { circleMonths: true },
  });

  if (!activeCircle) {
    await ctx.reply(ctx.t("errors-no-active-circle-payment"));
    return;
  }

  const state: PaymentState = {
    selectedMonthIds: [],
  };

  // 1. Ask for File (or check if already sent)
  if (ctx.message?.photo && ctx.message.photo.length > 0) {
    state.fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
  } else if (ctx.message?.document) {
    state.fileId = ctx.message.document.file_id;
  }

  if (!state.fileId) {
    await ctx.reply(ctx.t("payment-upload-proof"));
  }
  
  while (!state.fileId) {
    const { message } = await conversation.waitFor("message");
    
    if (message?.photo && message.photo.length > 0) {
      // Get the largest photo
      state.fileId = message.photo[message.photo.length - 1].file_id;
    } else if (message?.document) {
      state.fileId = message.document.file_id;
    } else if (message?.text === "/cancel") {
      await ctx.reply(ctx.t("payment-cancelled"));
      return;
    } else {
      await ctx.reply(ctx.t("payment-invalid-file"));
    }
  }

  let messageId: number | undefined;

  // 2. Month Selection Loop
  while (true) {
    // Fetch fresh data
    const locale = await ctx.i18n.getLocale();
    
    // Get all stocks for this user in this circle
    const userStocks = await ctx.db.query.stocks.findMany({
      where: and(
        eq(stocks.circleId, activeCircle.id),
        eq(stocks.userId, user.id)
      ),
      with: { circleMonth: true },
    });

    if (userStocks.length === 0) {
      await ctx.reply(ctx.t("payment-no-stocks"));
      return;
    }

    // Get existing payments
    const existingPayments = await ctx.db.query.payments.findMany({
      where: and(
        eq(payments.circleId, activeCircle.id),
        eq(payments.userId, user.id),
        eq(payments.status, "paid")
      ),
    });

    const paidMonthIds = new Set(existingPayments.map(p => p.monthId));

    // Filter for unpaid months
    const unpaidMonths = userStocks
      .map(s => s.circleMonth)
      .filter(m => !paidMonthIds.has(m.id))
      // Deduplicate months
      .filter((m, index, self) => index === self.findIndex(t => t.id === m.id))
      .sort((a, b) => a.index - b.index);

    if (unpaidMonths.length === 0) {
      await ctx.reply(ctx.t("payment-all-paid"));
      return;
    }

    // Default selection: "current month of the circle"
    if (state.selectedMonthIds.length === 0 && !messageId) {
        if (activeCircle.startDate) {
            const now = new Date();
            const startDate = activeCircle.startDate instanceof Date 
                ? activeCircle.startDate 
                : new Date(activeCircle.startDate * 1000);
            
            const monthsDiff = 
                (now.getFullYear() - startDate.getFullYear()) * 12 + 
                (now.getMonth() - startDate.getMonth());
            
            const targetIndex = monthsDiff + 1;
            
            const currentMonth = unpaidMonths.find(m => m.index === targetIndex);
            if (currentMonth) {
                state.selectedMonthIds.push(currentMonth.id);
            }
        }
    }

    // Build Keyboard
    const keyboard = new InlineKeyboard();
    
    unpaidMonths.forEach((month, idx) => {
      const isSelected = state.selectedMonthIds.includes(month.id);
      const icon = isSelected ? "✅ " : "⬜️ ";
      const localizedName = getLocalizedMonthName(month.name, locale);
      
      keyboard.text(`${icon}${localizedName}`, `toggle:${month.id}`);
      if (idx % 2 === 1) keyboard.row();
    });
    
    keyboard.row();
    
    if (state.selectedMonthIds.length > 0) {
        keyboard.text(ctx.t("payment-confirm"), "confirm");
    }
    keyboard.text(ctx.t("payment-cancel"), "cancel");

    const messageText = ctx.t("payment-select-months");
    const localizedText = wrapForLocale(messageText, locale);

    if (messageId) {
        try {
            await ctx.api.editMessageText(ctx.chat!.id, messageId, localizedText, {
                reply_markup: keyboard,
            });
        } catch (e) {
            // Ignore not modified
        }
    } else {
        const msg = await ctx.reply(localizedText, {
            reply_markup: keyboard,
        });
        messageId = msg.message_id;
    }

    // Wait for interaction
    const update = await conversation.waitFor("callback_query:data");
    const data = update.callbackQuery.data;
    await update.answerCallbackQuery();
    
    if (data === "cancel") {
        if (messageId) await ctx.api.deleteMessage(ctx.chat!.id, messageId);
        await ctx.reply(ctx.t("payment-cancelled"));
        return;
    }
    
     if (data === "confirm") {
         if (state.selectedMonthIds.length === 0) continue;
         
         const locale = await ctx.i18n.getLocale();
         
         // Save payments
         await ctx.db.transaction(async (tx) => {
             for (const monthId of state.selectedMonthIds) {
                 await tx.insert(payments as any).values({
                     userId: user.id,
                     circleId: activeCircle.id,
                     monthId: monthId,
                     fileId: state.fileId!,
                     status: "paid",
                     paidAt: new Date(),
                 });
             }
         });
         
         // Send notifications to admins for each paid month
         for (const monthId of state.selectedMonthIds) {
             try {
                 // Notify admins of payment
                 await notifyAdminsOfPayment(ctx.api.bot as any, ctx.db, {
                     userId: user.id,
                     circleId: activeCircle.id,
                     monthId: monthId,
                     locale,
                 });
                 
                 // Send payment report summary to admins
                 await generatePaymentReport(ctx.api.bot as any, ctx.db, activeCircle.id, monthId, locale);
             } catch (error) {
                 console.error(`Error sending admin notifications for month ${monthId}:`, error);
             }
         }
         
         if (messageId) await ctx.api.deleteMessage(ctx.chat!.id, messageId);
         await ctx.reply(ctx.t("payment-success"));
         return;
     }
    
    if (data.startsWith("toggle:")) {
        const monthId = Number(data.split(":")[1]);
        const idx = state.selectedMonthIds.indexOf(monthId);
        if (idx >= 0) {
            state.selectedMonthIds.splice(idx, 1);
        } else {
            state.selectedMonthIds.push(monthId);
        }
    }
  }
}

import { Bot } from "grammy";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { circles, payments, stocks, users } from "../db/schema";
import type { MyContext } from "./context";
import { db } from "./db";
import { getLocalizedMonthName, wrapForLocale } from "./helpers";
import { i18n } from "./i18n";

// Run check every hour
const CHECK_INTERVAL = 60 * 60 * 1000;
// Send reminders at 10 AM
const REMINDER_HOUR = 10;

export function startScheduler(bot: Bot<MyContext>) {
  // Run immediately on start (for dev/testing) - maybe skip in prod or make configurable?
  // For now, let's just start the interval.

  setInterval(() => runReminderCheck(bot), CHECK_INTERVAL);

  // Also run once shortly after startup to catch missed reminders if restarted?
  // Or just wait for the next hour.
  console.log("Scheduler started.");
}

async function runReminderCheck(bot: Bot<MyContext>) {
  const now = new Date();

  // Only run at 10 AM
  if (now.getHours() !== REMINDER_HOUR) {
    return;
  }

  console.log("Running reminder check...");

  try {
    // 1. Get all active (locked) circles
    const activeCircles = await db.query.circles.findMany({
      where: eq(circles.isLocked, true),
      with: { circleMonths: true },
    });

    for (const circle of activeCircles) {
      if (!circle.startDate) continue;

      const startDate = circle.startDate instanceof Date
        ? circle.startDate
        : new Date(circle.startDate * 1000);

      // Check each month in the circle
      for (const month of circle.circleMonths) {
        // Calculate the "target date" for this month
        // Month index is 1-based.
        // Month 1 = startDate. Month 2 = startDate + 1 month.
        const monthDate = new Date(startDate);
        monthDate.setMonth(monthDate.getMonth() + (month.index - 1));

        // Calculate "Reminder Start Date": 25th of the PREVIOUS month
        const reminderStartDate = new Date(monthDate);
        reminderStartDate.setMonth(reminderStartDate.getMonth() - 1);
        reminderStartDate.setDate(25);

        // Calculate "End Date" (end of the month? or just until next month starts?)
        // Usually reminders stop when paid, or maybe when the month is essentially "over" and it's late?
        // Requirement: "Send a daily reminder until that month is marked as paid".
        // Does it stop if the month passes? "Other unpaid months still get reminders".
        // So it keeps sending until paid.

        // Check if we are in the reminder window (>= 25th of previous month)
        // We also want to stop if it's WAY in the past? Maybe not specified.
        // Let's assume we send reminders for "current" and "future" months that are in the window.
        // If it's a past month and still unpaid, do we remind? "Other unpaid months still get reminders".
        // Yes, likely.

        if (now >= reminderStartDate) {
          // This month is due or coming due.

          // Find users who have stocks in this month
          const monthStocks = await db.query.stocks.findMany({
            where: and(
              eq(stocks.circleId, circle.id),
              eq(stocks.monthId, month.id)
            ),
            with: { user: true }
          });

          if (monthStocks.length === 0) continue;

          // Find who has PAID
          const paidRecords = await db.query.payments.findMany({
            where: and(
              eq(payments.circleId, circle.id),
              eq(payments.monthId, month.id),
              eq(payments.status, "paid")
            )
          });

          const paidUserIds = new Set(paidRecords.map(p => p.userId));

          // Identify users to remind
          const usersToRemind = new Set<number>();
          for (const stock of monthStocks) {
            if (!paidUserIds.has(stock.userId)) {
              usersToRemind.add(stock.userId);
            }
          }

          // Send reminders
          for (const userId of usersToRemind) {
            const userStock = monthStocks.find(s => s.userId === userId);
            if (!userStock || !userStock.user.telegramId) continue;

            try {
              const locale =
                userStock.user.languageCode ||
                  userStock.user.telegramId?.toString().startsWith("+") // dummy check, fallback
                  ? "en"
                  : "ar";

              const monthName = getLocalizedMonthName(month.name, locale);
              const text = i18n.t(
                locale || undefined,
                "payment-reminder",
                {
                  monthName,
                  circleName: circle.name,
                },
              );
              const wrapped = wrapForLocale(text, locale);

              await bot.api.sendMessage(userStock.user.telegramId, wrapped);
            } catch (e) {
              console.error(`Failed to send reminder to user ${userId}:`, e);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in reminder check:", error);
  }
}

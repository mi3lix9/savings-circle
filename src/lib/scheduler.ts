import { Bot } from "grammy";
import { and, eq } from "drizzle-orm";
import { circles, payments, stocks } from "../db/schema";
import type { MyContext } from "./context";
import { db } from "./db";
import { getLocalizedMonthName, wrapForLocale } from "./helpers";
import { i18n } from "./i18n";

// Check every minute to reliably catch 10 AM
const CHECK_INTERVAL = 60 * 1000;
// Send reminders at 10 AM
const REMINDER_HOUR = 10;
// Store last check time to prevent duplicate reminders
let lastReminderCheckTime: { date: Date; success: boolean } | null = null;

export function startScheduler(bot: Bot<MyContext>) {
  console.log("Scheduler started. Daily reminders will be sent at 10:00 AM");

  // Check if reminders need to be sent immediately (in case of bot restart)
  const now = new Date();
  if (now.getHours() === REMINDER_HOUR) {
    console.log("Current hour is 10 AM, running initial reminder check...");
    runReminderCheck(bot).catch((error) => {
      console.error("Error in initial reminder check:", error);
    });
  }

  // Set up interval to check every minute
  setInterval(() => {
    runReminderCheck(bot).catch((error) => {
      console.error("Error in scheduled reminder check:", error);
    });
  }, CHECK_INTERVAL);
}

/**
 * Get the current month for a circle based on its start date
 */
function getCurrentMonthIndex(startDate: Date): number {
  const now = new Date();
  const monthsDiff =
    (now.getFullYear() - startDate.getFullYear()) * 12 +
    (now.getMonth() - startDate.getMonth());

  // Month index is 1-based
  return monthsDiff + 1;
}

/**
 * Check if reminder was already sent today
 */
function hasReminderBeenSentToday(): boolean {
  if (!lastReminderCheckTime) return false;

  const lastCheck = lastReminderCheckTime.date;
  const now = new Date();

  // Check if both dates are the same day
  return (
    lastCheck.getFullYear() === now.getFullYear() &&
    lastCheck.getMonth() === now.getMonth() &&
    lastCheck.getDate() === now.getDate() &&
    lastReminderCheckTime.success
  );
}

async function runReminderCheck(bot: Bot<MyContext>) {
  const now = new Date();

  // Only run at 10 AM
  if (now.getHours() !== REMINDER_HOUR) {
    return;
  }

  // Prevent sending duplicate reminders if already sent today
  if (hasReminderBeenSentToday()) {
    return;
  }

  console.log(`[${new Date().toISOString()}] Running daily payment reminder check...`);

  try {
    // 1. Get all active (locked) circles
    const activeCircles = await db.query.circles.findMany({
      where: eq(circles.isLocked, true),
      with: { circleMonths: true },
    });

    if (activeCircles.length === 0) {
      console.log("No active circles found");
      lastReminderCheckTime = { date: now, success: true };
      return;
    }

    let totalRemindersSet = 0;

    for (const circle of activeCircles) {
      if (!circle.startDate) {
        console.warn(`Circle "${circle.name}" (ID: ${circle.id}) has no start date, skipping...`);
        continue;
      }

      const startDate =
        circle.startDate instanceof Date
          ? circle.startDate
          : new Date(circle.startDate * 1000);

      // Get the current month index for this circle
      const currentMonthIndex = getCurrentMonthIndex(startDate);

      // Find the current month in the circle
      const currentMonth = circle.circleMonths.find((m) => m.index === currentMonthIndex);

      if (!currentMonth) {
        console.log(
          `Circle "${circle.name}": No month found for current index ${currentMonthIndex}`
        );
        continue;
      }

      // Find users who have stocks in the current month
      const monthStocks = await db.query.stocks.findMany({
        where: and(
          eq(stocks.circleId, circle.id),
          eq(stocks.monthId, currentMonth.id)
        ),
        with: { user: true },
      });

      if (monthStocks.length === 0) {
        console.log(
          `Circle "${circle.name}", Month "${currentMonth.name}": No users with stocks`
        );
        continue;
      }

      // Find who has PAID for the current month
      const paidRecords = await db.query.payments.findMany({
        where: and(
          eq(payments.circleId, circle.id),
          eq(payments.monthId, currentMonth.id),
          eq(payments.status, "paid")
        ),
      });

      const paidUserIds = new Set(paidRecords.map((p) => p.userId));

      // Identify unpaid users to remind
      const unpaidUsers = new Map<number, typeof monthStocks[0]>();
      for (const stock of monthStocks) {
        if (!paidUserIds.has(stock.userId)) {
          unpaidUsers.set(stock.userId, stock);
        }
      }

      if (unpaidUsers.size === 0) {
        console.log(
          `Circle "${circle.name}", Month "${currentMonth.name}": All users have paid`
        );
        continue;
      }

      // Send reminders to unpaid users
      console.log(
        `Circle "${circle.name}", Month "${currentMonth.name}": Sending reminders to ${unpaidUsers.size} unpaid user(s)`
      );

      for (const [userId, userStock] of unpaidUsers) {
        if (!userStock.user.telegramId) {
          console.warn(`User ${userId} has no telegram ID, skipping...`);
          continue;
        }

        try {
          // Determine locale - default to 'en' if not set
          const locale = userStock.user.languageCode ?? "en";

          const monthName = getLocalizedMonthName(currentMonth.name, locale);
          const text = i18n.t(locale, "payment-reminder", {
            monthName,
            circleName: circle.name,
          });
          const wrapped = wrapForLocale(text, locale);

          await bot.api.sendMessage(userStock.user.telegramId, wrapped, {
            parse_mode: "HTML",
          });

          console.log(
            `✓ Reminder sent to user ${userId} (${userStock.user.firstName} ${userStock.user.lastName || ""}) for circle "${circle.name}"`
          );
          totalRemindersSet++;
        } catch (error) {
          console.error(
            `✗ Failed to send reminder to user ${userId} (${userStock.user.firstName}):`,
            error instanceof Error ? error.message : error
          );
        }
      }
    }

    console.log(
      `[${new Date().toISOString()}] Daily reminder check completed. Total reminders sent: ${totalRemindersSet}`
    );
    lastReminderCheckTime = { date: now, success: true };
  } catch (error) {
    console.error("Critical error in reminder check:", error);
    lastReminderCheckTime = { date: now, success: false };
  }
}

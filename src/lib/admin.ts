import { eq, and, sql } from "drizzle-orm";
import type { Bot } from "grammy";
import type { Database } from "./db";
import type { MyContext } from "./context";
import { users, circles, stocks, circleMonths, payments } from "../db/schema";
import { getLocalizedMonthName, wrapForLocale } from "./helpers";
import { i18n } from "./i18n";

export type UserWithStats = {
  id: number;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isAdmin: boolean;
  createdAt: Date;
  totalStocks: number;
  totalTurns: number;
  circlesCount: number;
};

export type UserDetails = {
  user: typeof users.$inferSelect;
  circles: Array<{
    circle: typeof circles.$inferSelect;
    stocks: Array<{
      stock: typeof stocks.$inferSelect;
      month: typeof circleMonths.$inferSelect;
      payment: typeof payments.$inferSelect | null;
    }>;
    totalStocks: number;
    totalPayout: number;
  }>;
  totalStocks: number;
  totalPayout: number;
  nextTurn: {
    month: typeof circleMonths.$inferSelect;
    circle: typeof circles.$inferSelect;
    monthsUntil: number;
  } | null;
};

export type CircleStocks = {
  circle: typeof circles.$inferSelect;
  months: Array<{
    month: typeof circleMonths.$inferSelect;
    totalStocks: number;
    filledStocks: number;
    emptyStocks: number;
    fillPercentage: number;
    users: Array<{
      user: typeof users.$inferSelect;
      stockCount: number;
    }>;
  }>;
  summary: {
    totalMonths: number;
    totalStocks: number;
    filledStocks: number;
    emptyStocks: number;
    overallFillPercentage: number;
  };
};

export async function getAllUsersWithStats(db: Database): Promise<UserWithStats[]> {
  const allUsers = await db.query.users.findMany({
    orderBy: (users, { asc }) => [asc(users.createdAt)],
  });

  const usersWithStats: UserWithStats[] = [];

  for (const user of allUsers) {
    const userStocks = await db.query.stocks.findMany({
      where: eq(stocks.userId, user.id),
    });

    const totalStocks = userStocks.reduce((sum, stock) => sum + stock.stockCount, 0);
    const uniqueMonths = new Set(userStocks.map((s) => s.monthId));
    const uniqueCircles = new Set(userStocks.map((s) => s.circleId));

    usersWithStats.push({
      id: user.id,
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt instanceof Date ? user.createdAt : new Date(Number(user.createdAt) * 1000),
      totalStocks,
      totalTurns: uniqueMonths.size,
      circlesCount: uniqueCircles.size,
    });
  }

  return usersWithStats;
}

export async function getUserDetails(
  db: Database,
  userId: number,
): Promise<UserDetails | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return null;
  }

  const userStocks = await db.query.stocks.findMany({
    where: eq(stocks.userId, userId),
    with: {
      circle: true,
      circleMonth: true,
    },
  });

  // Group stocks by circle
  const circlesMap = new Map<
    number,
    {
      circle: typeof circles.$inferSelect;
      stocks: Array<{
        stock: typeof stocks.$inferSelect;
        month: typeof circleMonths.$inferSelect;
        payment: typeof payments.$inferSelect | null;
      }>;
    }
  >();

  for (const stock of userStocks) {
    const circleId = stock.circleId;
    if (!circlesMap.has(circleId)) {
      const circle = await db.query.circles.findFirst({
        where: eq(circles.id, circleId),
      });
      if (circle) {
        circlesMap.set(circleId, {
          circle,
          stocks: [],
        });
      }
    }

    const payment = await db.query.payments.findFirst({
      where: and(
        eq(payments.userId, userId),
        eq(payments.monthId, stock.monthId),
        eq(payments.circleId, stock.circleId),
      ),
    });

    circlesMap.get(circleId)?.stocks.push({
      stock,
      month: stock.circleMonth,
      payment: payment || null,
    });
  }

  const circlesData = Array.from(circlesMap.values()).map((circleData) => {
    const totalStocks = circleData.stocks.reduce(
      (sum, item) => sum + item.stock.stockCount,
      0,
    );
    const totalPayout = totalStocks * circleData.circle.monthlyAmount;

    return {
      circle: circleData.circle,
      stocks: circleData.stocks.sort((a, b) => a.month.index - b.month.index),
      totalStocks,
      totalPayout,
    };
  });

  const totalStocks = userStocks.reduce((sum, stock) => sum + stock.stockCount, 0);
  const totalPayout = circlesData.reduce((sum, c) => sum + c.totalPayout, 0);

  // Find next turn (earliest month by index)
  // For now, we'll use the month index to determine order
  // TODO: Use circle startDate + month index to calculate actual dates
  let nextTurn: UserDetails["nextTurn"] = null;

  for (const circleData of circlesData) {
    for (const stockData of circleData.stocks) {
      if (!nextTurn || stockData.month.index < nextTurn.month.index) {
        // Calculate months until turn based on month index
        // Assuming circle starts from month 1, and we're currently at some point
        const monthsUntil = stockData.month.index; // Simplified - would need actual current month tracking
        nextTurn = {
          month: stockData.month,
          circle: circleData.circle,
          monthsUntil,
        };
      }
    }
  }

  return {
    user,
    circles: circlesData,
    totalStocks,
    totalPayout,
    nextTurn,
  };
}

export async function getCircleStocks(
  db: Database,
  circleId: number,
): Promise<CircleStocks | null> {
  const circle = await db.query.circles.findFirst({
    where: eq(circles.id, circleId),
    with: {
      circleMonths: {
        with: {
          stocks: {
            with: {
              user: true,
            },
          },
        },
      },
    },
  });

  if (!circle) {
    return null;
  }

  const monthsData = circle.circleMonths
    .sort((a, b) => a.index - b.index)
    .map((month) => {
      const filledStocks =
        month.stocks?.reduce((sum, stock) => sum + stock.stockCount, 0) || 0;
      const emptyStocks = month.totalStocks - filledStocks;
      const fillPercentage = month.totalStocks > 0
        ? (filledStocks / month.totalStocks) * 100
        : 0;

      const usersMap = new Map<number, { user: typeof users.$inferSelect; stockCount: number }>();

      for (const stock of month.stocks || []) {
        const userId = stock.userId;
        if (!usersMap.has(userId)) {
          usersMap.set(userId, {
            user: stock.user,
            stockCount: 0,
          });
        }
        usersMap.get(userId)!.stockCount += stock.stockCount;
      }

      return {
        month,
        totalStocks: month.totalStocks,
        filledStocks,
        emptyStocks,
        fillPercentage,
        users: Array.from(usersMap.values()),
      };
    });

  const summary = {
    totalMonths: monthsData.length,
    totalStocks: monthsData.reduce((sum, m) => sum + m.totalStocks, 0),
    filledStocks: monthsData.reduce((sum, m) => sum + m.filledStocks, 0),
    emptyStocks: monthsData.reduce((sum, m) => sum + m.emptyStocks, 0),
    overallFillPercentage: 0,
  };

  summary.overallFillPercentage =
    summary.totalStocks > 0
      ? (summary.filledStocks / summary.totalStocks) * 100
      : 0;

  return {
    circle,
    months: monthsData,
    summary,
  };
}

/**
 * Notify all admins about a new payment received
 */
export async function notifyAdminsOfPayment(
  bot: Bot<MyContext>,
  db: Database,
  paymentData: {
    userId: number;
    circleId: number;
    monthId: number;
    locale?: string;
  },
): Promise<void> {
  try {
    const { userId, circleId, monthId, locale = "en" } = paymentData;

    // Fetch user details
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user || !user.telegramId) {
      console.warn(`User ${userId} not found or has no telegramId`);
      return;
    }

    // Fetch circle details
    const circle = await db.query.circles.findFirst({
      where: eq(circles.id, circleId),
    });

    if (!circle) {
      console.warn(`Circle ${circleId} not found`);
      return;
    }

    // Fetch month details
    const month = await db.query.circleMonths.findFirst({
      where: eq(circleMonths.id, monthId),
    });

    if (!month) {
      console.warn(`Month ${monthId} not found`);
      return;
    }

    // Get user's stocks for this month to calculate payment amount
    const userStock = await db.query.stocks.findFirst({
      where: and(
        eq(stocks.userId, userId),
        eq(stocks.circleId, circleId),
        eq(stocks.monthId, monthId),
      ),
    });

    const paymentAmount = userStock
      ? circle.monthlyAmount * userStock.stockCount
      : circle.monthlyAmount;

    // Get all admin users
    const admins = await db.query.users.findMany({
      where: eq(users.isAdmin, true),
    });

    if (admins.length === 0) {
      console.log("No admins found to notify");
      return;
    }

    // Build localized message
    const monthName = getLocalizedMonthName(month.name, locale);
    const userName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.telegramId;
    const phone = user.phone || "Not provided";
    const timestamp = new Date().toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const messageText = i18n.t(locale, "admin-payment-notification", {
      userName,
      phone,
      circleName: circle.name,
      monthName,
      amount: paymentAmount.toFixed(2),
      timestamp,
    });

    const wrappedMessage = wrapForLocale(messageText, locale);

    // Send notification to each admin
    for (const admin of admins) {
      if (!admin.telegramId) {
        console.warn(`Admin ${admin.id} has no telegramId, skipping...`);
        continue;
      }

      try {
        await bot.api.sendMessage(admin.telegramId, wrappedMessage, {
          parse_mode: "HTML",
        });
        console.log(
          `✓ Payment notification sent to admin ${admin.id} (${admin.firstName})`,
        );
      } catch (error) {
        console.error(
          `✗ Failed to send payment notification to admin ${admin.id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  } catch (error) {
    console.error("Error in notifyAdminsOfPayment:", error);
  }
}

/**
 * Generate and send payment report to all admins
 */
export async function generatePaymentReport(
  bot: Bot<MyContext>,
  db: Database,
  circleId: number,
  monthId: number,
  locale: string = "en",
): Promise<void> {
  try {
    // Fetch circle and month details
    const circle = await db.query.circles.findFirst({
      where: eq(circles.id, circleId),
    });

    if (!circle) {
      console.warn(`Circle ${circleId} not found`);
      return;
    }

    const month = await db.query.circleMonths.findFirst({
      where: eq(circleMonths.id, monthId),
    });

    if (!month) {
      console.warn(`Month ${monthId} not found`);
      return;
    }

    // Get all users with stocks in this month
    const monthStocks = await db.query.stocks.findMany({
      where: and(
        eq(stocks.circleId, circleId),
        eq(stocks.monthId, monthId),
      ),
      with: { user: true },
    });

    if (monthStocks.length === 0) {
      console.log(`No stocks found for circle ${circleId} month ${monthId}`);
      return;
    }

    // Get all paid records for this month
    const paidRecords = await db.query.payments.findMany({
      where: and(
        eq(payments.circleId, circleId),
        eq(payments.monthId, monthId),
        eq(payments.status, "paid"),
      ),
    });

    const paidUserIds = new Set(paidRecords.map((p) => p.userId));

    // Separate paid and unpaid users with their amounts
    const paidUsers: Array<{ name: string; amount: number; userId: number }> = [];
    const unpaidUsers: Array<{ name: string; userId: number }> = [];

    for (const stock of monthStocks) {
      const amount = circle.monthlyAmount * stock.stockCount;
      const userName = `${stock.user.firstName ?? ""} ${stock.user.lastName ?? ""}`.trim() || stock.user.telegramId;

      if (paidUserIds.has(stock.userId)) {
        paidUsers.push({ name: userName, amount, userId: stock.userId });
      } else {
        unpaidUsers.push({ name: userName, userId: stock.userId });
      }
    }

    // Calculate totals
    const totalPaid = paidUsers.reduce((sum, u) => sum + u.amount, 0);
    const totalUnpaid = unpaidUsers.length * circle.monthlyAmount;
    const totalExpected = totalPaid + totalUnpaid;
    const paidPercentage = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0;
    const unpaidPercentage = totalExpected > 0 ? (totalUnpaid / totalExpected) * 100 : 0;

    // Build report message
    const monthName = getLocalizedMonthName(month.name, locale);
    let reportText = i18n.t(locale, "admin-report-title", {
      monthName,
      circleName: circle.name,
    });

    reportText += "\n\n";

    // Paid section
    if (paidUsers.length > 0) {
      reportText += i18n.t(locale, "admin-report-paid-section", { count: paidUsers.length }) + "\n";
      for (let i = 0; i < paidUsers.length; i++) {
        const user = paidUsers[i];
        reportText += i18n.t(locale, "admin-report-paid-item", {
          index: i + 1,
          userName: user.name,
          amount: user.amount.toFixed(2),
        }) + "\n";
      }
      reportText += "\n";
    }

    // Unpaid section
    if (unpaidUsers.length > 0) {
      reportText += i18n.t(locale, "admin-report-unpaid-section", { count: unpaidUsers.length }) + "\n";
      for (let i = 0; i < unpaidUsers.length; i++) {
        const user = unpaidUsers[i];
        reportText += i18n.t(locale, "admin-report-unpaid-item", {
          index: i + 1,
          userName: user.name,
        }) + "\n";
      }
      reportText += "\n";
    }

    // Summary section
    reportText += i18n.t(locale, "admin-report-summary") + "\n";
    reportText += i18n.t(locale, "admin-report-total-paid", {
      amount: totalPaid.toFixed(2),
      percentage: paidPercentage.toFixed(1),
    }) + "\n";
    reportText += i18n.t(locale, "admin-report-total-remaining", {
      amount: totalUnpaid.toFixed(2),
      percentage: unpaidPercentage.toFixed(1),
    }) + "\n";
    reportText += i18n.t(locale, "admin-report-total-expected", {
      amount: totalExpected.toFixed(2),
    });

    const wrappedReport = wrapForLocale(reportText, locale);

    // Get all admin users
    const admins = await db.query.users.findMany({
      where: eq(users.isAdmin, true),
    });

    if (admins.length === 0) {
      console.log("No admins found to send report");
      return;
    }

    // Send report to each admin
    for (const admin of admins) {
      if (!admin.telegramId) {
        console.warn(`Admin ${admin.id} has no telegramId, skipping...`);
        continue;
      }

      try {
        await bot.api.sendMessage(admin.telegramId, wrappedReport, {
          parse_mode: "HTML",
        });
        console.log(`✓ Payment report sent to admin ${admin.id} (${admin.firstName})`);
      } catch (error) {
        console.error(
          `✗ Failed to send payment report to admin ${admin.id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  } catch (error) {
    console.error("Error in generatePaymentReport:", error);
  }
}


import { eq, and, sql } from "drizzle-orm";
import type { Database } from "./db";
import { users, circles, stocks, circleMonths, payments } from "../db/schema";

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


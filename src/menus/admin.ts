import { Menu } from "@grammyjs/menu";
import {
  getAllUsersWithStats,
  getCircleStocks,
  getUserDetails,
} from "../lib/admin";
import type { MyContext } from "../lib/context";

// Helper function to format user name
function formatUserName(user: { firstName: string | null; lastName: string | null; telegramId: string }): string {
  const firstName = user.firstName || "";
  const lastName = user.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || user.telegramId;
}

// Main admin menu
export const adminMainMenu = new Menu<MyContext>("admin-main")
  .text((ctx) => ctx.t("admin-view-users"), async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.menu.nav("admin-users");
  })
  .row()
  .text((ctx) => ctx.t("admin-view-stocks"), async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.menu.nav("admin-circles");
  })
  .row()
  .text((ctx) => ctx.t("admin-statistics"), async (ctx) => {
    await ctx.answerCallbackQuery();
    const users = await getAllUsersWithStats(ctx.db);
    const allCircles = await ctx.db.query.circles.findMany();

    const totalUsers = users.length;
    const totalStocks = users.reduce((sum, u) => sum + u.totalStocks, 0);
    const totalCircles = allCircles.length;
    const activeCircles = allCircles.filter((c) => !c.isLocked).length;

    await ctx.reply(
      ctx.t("admin-stats-title") + "\n\n" +
      ctx.t("admin-total-users", { count: totalUsers }) + "\n" +
      ctx.t("admin-total-stocks", { count: totalStocks }) + "\n" +
      ctx.t("admin-total-circles", { count: totalCircles }) + "\n" +
      ctx.t("admin-active-circles", { count: activeCircles }) + "\n" +
      ctx.t("admin-locked-circles", { count: totalCircles - activeCircles }),
      { reply_markup: adminMainMenu },
    );
  });

// Users list menu
export const adminUsersMenu = new Menu<MyContext>("admin-users")
  .dynamic(async (ctx, range) => {
    const users = await getAllUsersWithStats(ctx.db);
    range.text((ctx) => ctx.t("admin-back"), (ctx) => {
      ctx.menu.nav("admin-main");
    });

    if (users.length === 0) {
      return range;
    }

    range.row();

    // Show up to 20 users per page (Telegram limit is ~100 buttons)
    const usersToShow = users.slice(0, 20);
    for (const user of usersToShow) {
      const userName = formatUserName(user);
      range.text((ctx) => ctx.t("admin-user-label", { userName, stockCount: user.totalStocks, turnCount: user.totalTurns }), async (ctx) => {
        await ctx.answerCallbackQuery();
        const userDetails = await getUserDetails(ctx.db, user.id);
        if (userDetails) {
          const { user: u, circles: userCircles, totalStocks, totalPayout, nextTurn } = userDetails;
          let message = ctx.t("admin-user-details-title") + "\n\n";
          message += ctx.t("admin-telegram-id", { id: u.telegramId }) + "\n";
          message += ctx.t("admin-phone", { phone: u.phone || ctx.t("admin-not-provided") }) + "\n";
          message += ctx.t("admin-registered", { date: new Date(u.createdAt).toLocaleDateString() }) + "\n";
          message += ctx.t("admin-is-admin", { status: u.isAdmin ? ctx.t("admin-yes") : ctx.t("admin-no") }) + "\n\n";
          message += ctx.t("admin-summary-title") + "\n";
          message += ctx.t("admin-total-stocks", { count: totalStocks }) + "\n";
          message += ctx.t("admin-total-payout", { amount: totalPayout.toFixed(2) }) + "\n";
          if (nextTurn) {
            message += ctx.t("admin-next-turn", { monthName: nextTurn.month.name, monthsUntil: nextTurn.monthsUntil }) + "\n";
          }
          message += ctx.t("admin-circles-count", { count: userCircles.length }) + "\n\n";
          if (userCircles.length > 0) {
            message += ctx.t("admin-circles-turns") + "\n";
            for (const circleData of userCircles) {
              message += "\n" + ctx.t("admin-circle-name", { circleName: circleData.circle.name }) + "\n";
              message += ctx.t("admin-circle-stocks-payout", { stockCount: circleData.totalStocks, payout: circleData.totalPayout.toFixed(2) }) + "\n";
              message += ctx.t("admin-turns") + "\n";
              for (const stockData of circleData.stocks) {
                const paid = stockData.payment?.paid;
                message += paid
                  ? ctx.t("admin-turn-paid", { monthName: stockData.month.name, stockCount: stockData.stock.stockCount }) + "\n"
                  : ctx.t("admin-turn-unpaid", { monthName: stockData.month.name, stockCount: stockData.stock.stockCount }) + "\n";
              }
            }
          }
          if (message.length > 4000) {
            message = message.substring(0, 4000) + "\n\n... (truncated)";
          }
          await ctx.editMessageText(message);
        }
        (ctx.menu.nav as any)("admin-user", String(user.id));
      });
      range.row();
    }

    if (users.length > 20) {
      range.text((ctx) => ctx.t("admin-more-users", { count: users.length - 20 }), (ctx) => {
        ctx.answerCallbackQuery({ text: ctx.t("admin-too-many-users") });
      });
      range.row();
    }

    return range;
  })
  .row()
  .text((ctx) => ctx.t("admin-back"), (ctx) => {
    ctx.menu.nav("admin-main");
  });

// User details menu
export const adminUserMenu = new Menu<MyContext>("admin-user")
  .dynamic(async (ctx, range) => {
    const payload = ctx.match as string | undefined;
    const userId = payload ? Number(payload) : undefined;
    if (!userId || isNaN(userId)) {
      range.text((ctx) => ctx.t("errors-invalid-user"), (ctx) => ctx.answerCallbackQuery());
      return range;
    }

    const userDetails = await getUserDetails(ctx.db, userId);
    if (!userDetails) {
      range.text((ctx) => ctx.t("errors-user-not-found"), (ctx) => ctx.answerCallbackQuery());
      return range;
    }

    const { circles: userCircles } = userDetails;

    // Add buttons for each circle
    for (const circleData of userCircles) {
      range.text((ctx) => ctx.t("admin-circle-name", { circleName: circleData.circle.name }), async (ctx) => {
        await ctx.answerCallbackQuery();
        const circleStocks = await getCircleStocks(ctx.db, circleData.circle.id);
        if (circleStocks) {
          const { circle: c, months, summary } = circleStocks;
          let message = ctx.t("admin-stocks-title", { circleName: c.name }) + "\n\n";
          message += ctx.t("admin-summary-label") + "\n";
          message += ctx.t("admin-total-months", { count: summary.totalMonths }) + "\n";
          message += ctx.t("admin-total-stocks-summary", { count: summary.totalStocks }) + "\n";
          message += ctx.t("admin-filled", { count: summary.filledStocks }) + "\n";
          message += ctx.t("admin-empty", { count: summary.emptyStocks }) + "\n";
          message += ctx.t("admin-fill-rate", { percentage: summary.overallFillPercentage.toFixed(1) }) + "\n\n";
          message += ctx.t("admin-monthly-breakdown") + "\n";
          for (const monthData of months) {
            message += "\n" + ctx.t("admin-month-stats", { monthName: monthData.month.name }) + "\n";
            message += ctx.t("admin-month-totals", { total: monthData.totalStocks, filled: monthData.filledStocks, empty: monthData.emptyStocks }) + "\n";
            message += ctx.t("admin-month-fill", { percentage: monthData.fillPercentage.toFixed(1) }) + "\n";
            if (monthData.users.length > 0) {
              message += ctx.t("admin-month-users") + "\n";
              for (const userData of monthData.users) {
                const userName = formatUserName(userData.user);
                message += ctx.t("admin-month-user", { userName, stockCount: userData.stockCount }) + "\n";
              }
            }
          }
          if (message.length > 4000) {
            message = message.substring(0, 4000) + "\n\n... (truncated)";
          }
          await ctx.editMessageText(message);
        }
        (ctx.menu.nav as any)("admin-stocks", String(circleData.circle.id));
      });
      range.row();
    }

    range.text((ctx) => ctx.t("admin-back-to-users"), (ctx) => {
      ctx.menu.nav("admin-users");
    });

    return range;
  });

// Circles list menu
export const adminCirclesMenu = new Menu<MyContext>("admin-circles")
  .dynamic(async (ctx, range) => {
    const allCircles = await ctx.db.query.circles.findMany({
      orderBy: (circles, { desc }) => [desc(circles.createdAt)],
    });

    range.text((ctx) => ctx.t("admin-back"), (ctx) => {
      ctx.menu.nav("admin-main");
    });

    if (allCircles.length === 0) {
      return range;
    }

    range.row();

    for (const circle of allCircles) {
      range.text((ctx) => {
        const status = circle.isLocked ? ctx.t("admin-circle-status-locked") : ctx.t("admin-circle-status-active");
        return `${status} ${circle.name}`;
      }, async (ctx) => {
        await ctx.answerCallbackQuery();
        const circleStocks = await getCircleStocks(ctx.db, circle.id);
        if (circleStocks) {
          const { circle: c, months, summary } = circleStocks;
          let message = ctx.t("admin-stocks-title", { circleName: c.name }) + "\n\n";
          message += ctx.t("admin-summary-label") + "\n";
          message += ctx.t("admin-total-months", { count: summary.totalMonths }) + "\n";
          message += ctx.t("admin-total-stocks-summary", { count: summary.totalStocks }) + "\n";
          message += ctx.t("admin-filled", { count: summary.filledStocks }) + "\n";
          message += ctx.t("admin-empty", { count: summary.emptyStocks }) + "\n";
          message += ctx.t("admin-fill-rate", { percentage: summary.overallFillPercentage.toFixed(1) }) + "\n\n";
          message += ctx.t("admin-monthly-breakdown") + "\n";
          for (const monthData of months) {
            message += "\n" + ctx.t("admin-month-stats", { monthName: monthData.month.name }) + "\n";
            message += ctx.t("admin-month-totals", { total: monthData.totalStocks, filled: monthData.filledStocks, empty: monthData.emptyStocks }) + "\n";
            message += ctx.t("admin-month-fill", { percentage: monthData.fillPercentage.toFixed(1) }) + "\n";
            if (monthData.users.length > 0) {
              message += ctx.t("admin-month-users") + "\n";
              for (const userData of monthData.users) {
                const userName = formatUserName(userData.user);
                message += ctx.t("admin-month-user", { userName, stockCount: userData.stockCount }) + "\n";
              }
            }
          }
          if (message.length > 4000) {
            message = message.substring(0, 4000) + "\n\n... (truncated)";
          }
          await ctx.editMessageText(message);
        }
        (ctx.menu.nav as any)("admin-stocks", String(circle.id));
      });
      range.row();
    }

    return range;
  })
  .row()
  .text((ctx) => ctx.t("admin-back"), (ctx) => {
    ctx.menu.nav("admin-main");
  });

// Circle stocks menu
export const adminStocksMenu = new Menu<MyContext>("admin-stocks")
  .dynamic(async (ctx, range) => {
    const payload = ctx.match as string | undefined;
    const circleId = payload ? Number(payload) : undefined;
    if (!circleId || isNaN(circleId)) {
      range.text((ctx) => ctx.t("errors-invalid-circle"), (ctx) => ctx.answerCallbackQuery());
      return range;
    }

    const circleStocks = await getCircleStocks(ctx.db, circleId);
    if (!circleStocks) {
      range.text((ctx) => ctx.t("errors-circle-not-found"), (ctx) => ctx.answerCallbackQuery());
      return range;
    }

    const { months } = circleStocks;

    // Add buttons for users in each month
    for (const monthData of months) {
      if (monthData.users.length > 0) {
        range.text((ctx) => ctx.t("admin-month-stats", { monthName: monthData.month.name }), (ctx) => {
          ctx.answerCallbackQuery({ text: ctx.t("admin-month-filled-info", { monthName: monthData.month.name, filled: monthData.filledStocks, total: monthData.totalStocks }) });
        });
        range.row();
        for (const userData of monthData.users) {
          const userName = formatUserName(userData.user);
          range.text((ctx) => `👤 ${userName} (${userData.stockCount})`, async (ctx) => {
            await ctx.answerCallbackQuery();
            const userDetails = await getUserDetails(ctx.db, userData.user.id);
            if (userDetails) {
              const { user: u, circles: userCircles, totalStocks, totalPayout, nextTurn } = userDetails;
              let message = ctx.t("admin-user-details-title") + "\n\n";
              message += ctx.t("admin-telegram-id", { id: u.telegramId }) + "\n";
              message += ctx.t("admin-phone", { phone: u.phone || ctx.t("admin-not-provided") }) + "\n";
              const regDate = u.createdAt instanceof Date ? u.createdAt : new Date(Number(u.createdAt) * 1000);
              message += ctx.t("admin-registered", { date: regDate.toLocaleDateString() }) + "\n";
              message += ctx.t("admin-is-admin", { status: u.isAdmin ? ctx.t("admin-yes") : ctx.t("admin-no") }) + "\n\n";
              message += ctx.t("admin-summary-title") + "\n";
              message += ctx.t("admin-total-stocks", { count: totalStocks }) + "\n";
              message += ctx.t("admin-total-payout", { amount: totalPayout.toFixed(2) }) + "\n";
              if (nextTurn) {
                message += ctx.t("admin-next-turn", { monthName: nextTurn.month.name, monthsUntil: nextTurn.monthsUntil }) + "\n";
              }
              message += ctx.t("admin-circles-count", { count: userCircles.length }) + "\n\n";
              if (userCircles.length > 0) {
                message += ctx.t("admin-circles-turns") + "\n";
                for (const circleData of userCircles) {
                  message += "\n" + ctx.t("admin-circle-name", { circleName: circleData.circle.name }) + "\n";
                  message += ctx.t("admin-circle-stocks-payout", { stockCount: circleData.totalStocks, payout: circleData.totalPayout.toFixed(2) }) + "\n";
                  message += ctx.t("admin-turns") + "\n";
                  for (const stockData of circleData.stocks) {
                    const paid = stockData.payment?.paid;
                    message += paid
                      ? ctx.t("admin-turn-paid", { monthName: stockData.month.name, stockCount: stockData.stock.stockCount }) + "\n"
                      : ctx.t("admin-turn-unpaid", { monthName: stockData.month.name, stockCount: stockData.stock.stockCount }) + "\n";
                  }
                }
              }
              if (message.length > 4000) {
                message = message.substring(0, 4000) + "\n\n... (truncated)";
              }
              await ctx.editMessageText(message);
            }
            (ctx.menu.nav as any)("admin-user", String(userData.user.id));
          });
        }
        range.row();
      }
    }

    range.text((ctx) => ctx.t("admin-back-to-circles"), (ctx) => {
      ctx.menu.nav("admin-circles");
    });

    return range;
  });

// Register all menus
adminMainMenu.register(adminUsersMenu);
adminMainMenu.register(adminUserMenu);
adminMainMenu.register(adminCirclesMenu);
adminMainMenu.register(adminStocksMenu);


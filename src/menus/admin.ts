import { Menu, MenuRange } from "@grammyjs/menu";
import type { MyContext } from "../lib/context";
import {
  getAllUsersWithStats,
  getUserDetails,
  getCircleStocks,
} from "../lib/admin";
import { circles } from "../db/schema";
import { eq } from "drizzle-orm";

// Main admin menu
export const adminMainMenu = new Menu<MyContext>("admin-main")
  .text("👥 View All Users", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.menu.nav("admin-users");
  })
  .row()
  .text("📊 View Stocks", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.menu.nav("admin-circles");
  })
  .row()
  .text("📈 Statistics", async (ctx) => {
    await ctx.answerCallbackQuery();
    const users = await getAllUsersWithStats(ctx.db);
    const allCircles = await ctx.db.query.circles.findMany();

    const totalUsers = users.length;
    const totalStocks = users.reduce((sum, u) => sum + u.totalStocks, 0);
    const totalCircles = allCircles.length;
    const activeCircles = allCircles.filter((c) => !c.isLocked).length;

    await ctx.reply(
      `📈 Admin Statistics\n\n` +
        `👥 Total Users: ${totalUsers}\n` +
        `📊 Total Stocks: ${totalStocks}\n` +
        `🔄 Total Circles: ${totalCircles}\n` +
        `✅ Active Circles: ${activeCircles}\n` +
        `🔒 Locked Circles: ${totalCircles - activeCircles}`,
      { reply_markup: adminMainMenu },
    );
  });

// Users list menu
export const adminUsersMenu = new Menu<MyContext>("admin-users")
  .dynamic(async (ctx, range) => {
    const users = await getAllUsersWithStats(ctx.db);
    range.text("🔙 Back", (ctx) => {
      ctx.menu.nav("admin-main");
    });

    if (users.length === 0) {
      return range;
    }

    range.row();

    // Show up to 20 users per page (Telegram limit is ~100 buttons)
    const usersToShow = users.slice(0, 20);
    for (const user of usersToShow) {
      const label = `👤 ${user.telegramId} (${user.totalStocks} stocks, ${user.totalTurns} turns)`;
      range.text(label, async (ctx) => {
        await ctx.answerCallbackQuery();
        const userDetails = await getUserDetails(ctx.db, user.id);
        if (userDetails) {
          const { user: u, circles: userCircles, totalStocks, totalPayout, nextTurn } = userDetails;
          let message = `👤 User Details\n\n`;
          message += `🆔 Telegram ID: ${u.telegramId}\n`;
          message += `📱 Phone: ${u.phone || "Not provided"}\n`;
          message += `📅 Registered: ${new Date(u.createdAt).toLocaleDateString()}\n`;
          message += `👑 Admin: ${u.isAdmin ? "Yes" : "No"}\n\n`;
          message += `📊 Summary:\n`;
          message += `• Total Stocks: ${totalStocks}\n`;
          message += `• Total Payout: ${totalPayout.toFixed(2)} SAR\n`;
          if (nextTurn) {
            message += `• Next Turn: ${nextTurn.month.name} (in ${nextTurn.monthsUntil} months)\n`;
          }
          message += `• Circles: ${userCircles.length}\n\n`;
          if (userCircles.length > 0) {
            message += `🔄 Circles & Turns:\n`;
            for (const circleData of userCircles) {
              message += `\n📌 ${circleData.circle.name}\n`;
              message += `   Stocks: ${circleData.totalStocks}, Payout: ${circleData.totalPayout.toFixed(2)} SAR\n`;
              message += `   Turns:\n`;
              for (const stockData of circleData.stocks) {
                const paid = stockData.payment?.paid ? "✅" : "❌";
                message += `   ${paid} ${stockData.month.name}: ${stockData.stock.stockCount} stock(s)\n`;
              }
            }
          }
          if (message.length > 4000) {
            message = message.substring(0, 4000) + "\n\n... (truncated)";
          }
          await ctx.editMessageText(message);
        }
        await ctx.menu.nav("admin-user", String(user.id));
      });
      range.row();
    }

    if (users.length > 20) {
      range.text(`... and ${users.length - 20} more users`, (ctx) => {
        ctx.answerCallbackQuery({ text: "Too many users to display. Showing first 20." });
      });
      range.row();
    }

    return range;
  })
  .row()
  .text("🔙 Back", (ctx) => {
    ctx.menu.nav("admin-main");
  });

// User details menu
export const adminUserMenu = new Menu<MyContext>("admin-user")
  .dynamic(async (ctx, range) => {
    const payload = ctx.match as string | undefined;
    const userId = payload ? Number(payload) : undefined;
    if (!userId || isNaN(userId)) {
      range.text("❌ Invalid user", (ctx) => ctx.answerCallbackQuery());
      return range;
    }

    const userDetails = await getUserDetails(ctx.db, userId);
    if (!userDetails) {
      range.text("❌ User not found", (ctx) => ctx.answerCallbackQuery());
      return range;
    }

    const { circles: userCircles } = userDetails;

    // Add buttons for each circle
    for (const circleData of userCircles) {
      range.text(`📌 ${circleData.circle.name}`, async (ctx) => {
        await ctx.answerCallbackQuery();
        const circleStocks = await getCircleStocks(ctx.db, circleData.circle.id);
        if (circleStocks) {
          const { circle: c, months, summary } = circleStocks;
          let message = `📊 Stocks: ${c.name}\n\n`;
          message += `📈 Summary:\n`;
          message += `• Total Months: ${summary.totalMonths}\n`;
          message += `• Total Stocks: ${summary.totalStocks}\n`;
          message += `• Filled: ${summary.filledStocks}\n`;
          message += `• Empty: ${summary.emptyStocks}\n`;
          message += `• Fill Rate: ${summary.overallFillPercentage.toFixed(1)}%\n\n`;
          message += `📅 Monthly Breakdown:\n`;
          for (const monthData of months) {
            message += `\n${monthData.month.name}\n`;
            message += `  Total: ${monthData.totalStocks}, Filled: ${monthData.filledStocks}, Empty: ${monthData.emptyStocks}\n`;
            message += `  Fill: ${monthData.fillPercentage.toFixed(1)}%\n`;
            if (monthData.users.length > 0) {
              message += `  Users:\n`;
              for (const userData of monthData.users) {
                message += `    👤 ${userData.user.telegramId}: ${userData.stockCount} stock(s)\n`;
              }
            }
          }
          if (message.length > 4000) {
            message = message.substring(0, 4000) + "\n\n... (truncated)";
          }
          await ctx.editMessageText(message);
        }
        await ctx.menu.nav("admin-stocks", String(circleData.circle.id));
      });
      range.row();
    }

    range.text("🔙 Back to Users", (ctx) => {
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

    range.text("🔙 Back", (ctx) => {
      ctx.menu.nav("admin-main");
    });

    if (allCircles.length === 0) {
      return range;
    }

    range.row();

    for (const circle of allCircles) {
      const status = circle.isLocked ? "🔒" : "✅";
      const label = `${status} ${circle.name}`;
      range.text(label, async (ctx) => {
        await ctx.answerCallbackQuery();
        const circleStocks = await getCircleStocks(ctx.db, circle.id);
        if (circleStocks) {
          const { circle: c, months, summary } = circleStocks;
          let message = `📊 Stocks: ${c.name}\n\n`;
          message += `📈 Summary:\n`;
          message += `• Total Months: ${summary.totalMonths}\n`;
          message += `• Total Stocks: ${summary.totalStocks}\n`;
          message += `• Filled: ${summary.filledStocks}\n`;
          message += `• Empty: ${summary.emptyStocks}\n`;
          message += `• Fill Rate: ${summary.overallFillPercentage.toFixed(1)}%\n\n`;
          message += `📅 Monthly Breakdown:\n`;
          for (const monthData of months) {
            message += `\n${monthData.month.name}\n`;
            message += `  Total: ${monthData.totalStocks}, Filled: ${monthData.filledStocks}, Empty: ${monthData.emptyStocks}\n`;
            message += `  Fill: ${monthData.fillPercentage.toFixed(1)}%\n`;
            if (monthData.users.length > 0) {
              message += `  Users:\n`;
              for (const userData of monthData.users) {
                message += `    👤 ${userData.user.telegramId}: ${userData.stockCount} stock(s)\n`;
              }
            }
          }
          if (message.length > 4000) {
            message = message.substring(0, 4000) + "\n\n... (truncated)";
          }
          await ctx.editMessageText(message);
        }
        await ctx.menu.nav("admin-stocks", String(circle.id));
      });
      range.row();
    }

    return range;
  })
  .row()
  .text("🔙 Back", (ctx) => {
    ctx.menu.nav("admin-main");
  });

// Circle stocks menu
export const adminStocksMenu = new Menu<MyContext>("admin-stocks")
  .dynamic(async (ctx, range) => {
    const payload = ctx.match as string | undefined;
    const circleId = payload ? Number(payload) : undefined;
    if (!circleId || isNaN(circleId)) {
      range.text("❌ Invalid circle", (ctx) => ctx.answerCallbackQuery());
      return range;
    }

    const circleStocks = await getCircleStocks(ctx.db, circleId);
    if (!circleStocks) {
      range.text("❌ Circle not found", (ctx) => ctx.answerCallbackQuery());
      return range;
    }

    const { months } = circleStocks;

    // Add buttons for users in each month
    for (const monthData of months) {
      if (monthData.users.length > 0) {
        range.text(`📅 ${monthData.month.name}`, (ctx) => {
          ctx.answerCallbackQuery({ text: `${monthData.month.name}: ${monthData.filledStocks}/${monthData.totalStocks} filled` });
        });
        range.row();
        for (const userData of monthData.users) {
          range.text(`👤 ${userData.user.telegramId} (${userData.stockCount})`, async (ctx) => {
            await ctx.answerCallbackQuery();
            const userDetails = await getUserDetails(ctx.db, userData.user.id);
            if (userDetails) {
              const { user: u, circles: userCircles, totalStocks, totalPayout, nextTurn } = userDetails;
              let message = `👤 User Details\n\n`;
              message += `🆔 Telegram ID: ${u.telegramId}\n`;
              message += `📱 Phone: ${u.phone || "Not provided"}\n`;
              const regDate = u.createdAt instanceof Date ? u.createdAt : new Date(Number(u.createdAt) * 1000);
              message += `📅 Registered: ${regDate.toLocaleDateString()}\n`;
              message += `👑 Admin: ${u.isAdmin ? "Yes" : "No"}\n\n`;
              message += `📊 Summary:\n`;
              message += `• Total Stocks: ${totalStocks}\n`;
              message += `• Total Payout: ${totalPayout.toFixed(2)} SAR\n`;
              if (nextTurn) {
                message += `• Next Turn: ${nextTurn.month.name} (in ${nextTurn.monthsUntil} months)\n`;
              }
              message += `• Circles: ${userCircles.length}\n\n`;
              if (userCircles.length > 0) {
                message += `🔄 Circles & Turns:\n`;
                for (const circleData of userCircles) {
                  message += `\n📌 ${circleData.circle.name}\n`;
                  message += `   Stocks: ${circleData.totalStocks}, Payout: ${circleData.totalPayout.toFixed(2)} SAR\n`;
                  message += `   Turns:\n`;
                  for (const stockData of circleData.stocks) {
                    const paid = stockData.payment?.paid ? "✅" : "❌";
                    message += `   ${paid} ${stockData.month.name}: ${stockData.stock.stockCount} stock(s)\n`;
                  }
                }
              }
              if (message.length > 4000) {
                message = message.substring(0, 4000) + "\n\n... (truncated)";
              }
              await ctx.editMessageText(message);
            }
            await ctx.menu.nav("admin-user", String(userData.user.id));
          });
        }
        range.row();
      }
    }

    range.text("🔙 Back to Circles", (ctx) => {
      ctx.menu.nav("admin-circles");
    });

    return range;
  });

// Register all menus
adminMainMenu.register(adminUsersMenu);
adminMainMenu.register(adminUserMenu);
adminMainMenu.register(adminCirclesMenu);
adminMainMenu.register(adminStocksMenu);


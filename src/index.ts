import { conversations, createConversation } from "@grammyjs/conversations";
import { Bot } from "grammy";
import { eq } from "drizzle-orm";
import { createCircleConversation } from "./conversations/createCircle";
import { subscribeConversation } from "./conversations/subscribe";
import { paymentConversation } from "./conversations/payment";
import { onboarding } from "./conversations/onboarding";
import { circles } from "./db/schema";
import type { MyContext } from "./lib/context";
import { setCommandsForUser } from "./lib/commands";
import { db } from "./lib/db";
import { getLocalizedMonthName, getUserTurns, wrapForLocale } from "./lib/helpers";
import { i18n } from "./lib/i18n";
import { requireAdmin, userMiddleware } from "./lib/users";
import { startScheduler } from "./lib/scheduler";
import { adminMainMenu } from "./menus/admin";

const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

const dbMiddleware = async (ctx: MyContext, next: () => Promise<void>) => {
  ctx.db = db;
  return next();
};

bot.use(i18n);
bot.use(dbMiddleware);
bot.use(userMiddleware);

// Install admin menu (must be before conversations to handle callback queries)
bot.use(adminMainMenu);

bot.use(conversations());
bot.use(createConversation(subscribeConversation, { plugins: [dbMiddleware, userMiddleware, i18n] }));
bot.use(createConversation(createCircleConversation, { plugins: [dbMiddleware, userMiddleware, i18n] }));
bot.use(createConversation(onboarding, { plugins: [dbMiddleware, userMiddleware, i18n] }));
bot.use(createConversation(paymentConversation, { plugins: [dbMiddleware, userMiddleware, i18n] }));

bot.command("start", async (ctx) => {
  // Set commands for user to ensure they're up to date
  if (ctx.from && ctx.user) {
    await setCommandsForUser(ctx, ctx.from.id, ctx.user.isAdmin);
  }
  await ctx.conversation.enter("onboarding");
});

bot.command("subscribe", async (ctx) => {
  await ctx.conversation.enter("subscribeConversation");
});

bot.command("pay", async (ctx) => {
  await ctx.conversation.enter("paymentConversation");
});

bot.on([":photo", ":document"], async (ctx) => {
  await ctx.conversation.enter("paymentConversation");
});

bot.command("myturn", async (ctx) => {
  const result = await getUserTurns(ctx.db, ctx.user.id);
  const locale = await ctx.i18n.getLocale();

  if (result.turns.length === 0) {
    await ctx.reply(ctx.t("myturn-no-turns"));
    return;
  }

  let message = ctx.t("myturn-title") + "\n\n";
  message += ctx.t("myturn-monthly-payout", { amount: result.totalMonthlyPayout.toFixed(2) }) + "\n\n";

  // Group turns by circle
  const turnsByCircle = new Map<number, typeof result.turns>();
  for (const turn of result.turns) {
    if (!turnsByCircle.has(turn.circleId)) {
      turnsByCircle.set(turn.circleId, []);
    }
    turnsByCircle.get(turn.circleId)!.push(turn);
  }

  // Display each circle's turns
  for (const [circleId, turns] of turnsByCircle) {
    const firstTurn = turns[0];
    if (!firstTurn) continue;
    message += `📌 <b>${firstTurn.circleName}</b>\n`;

    for (const turn of turns) {
      let statusText: string;
      if (turn.status === "past") {
        statusText = ctx.t("myturn-already-gone");
      } else if (turn.status === "current") {
        statusText = ctx.t("myturn-current");
      } else {
        statusText = ctx.t("myturn-months-until", { months: turn.monthsUntil });
      }

      message += ctx.t("myturn-month-item", {
        monthName: getLocalizedMonthName(turn.monthName, locale),
        amount: turn.payoutAmount.toFixed(2),
        stockCount: turn.stockCount,
        status: statusText,
      }) + "\n";
    }
    message += "\n";
  }

  await ctx.reply(wrapForLocale(message, locale), { parse_mode: "HTML" });
});

bot.command("create_circle", async (ctx) => {
  const admin = await requireAdmin(ctx);
  if (!admin) {
    await ctx.reply(ctx.t("errors-only-admins"));
    return;
  }
  await ctx.reply(ctx.t("circle-starting-wizard"));
  await ctx.conversation.enter("createCircleConversation");
});

bot.command("start_circle", async (ctx) => {
  const admin = await requireAdmin(ctx);
  if (!admin) {
    await ctx.reply(ctx.t("errors-only-admins-start-circle"));
    return;
  }

  const circle = await ctx.db.query.circles.findFirst({
    where: eq(circles.isLocked, false),
    with: { circleMonths: true },
  });

  if (!circle) {
    await ctx.reply(ctx.t("errors-no-open-circle"));
    return;
  }

  await ctx.db
    .update(circles as any)
    .set({ isLocked: true })
    .where(eq(circles.id, circle.id));

  const monthCount = circle.circleMonths?.length ?? 0;
  await ctx.reply(
    ctx.t("circle-locked", { circleName: circle.name, monthCount }),
  );
});

bot.command("admin", async (ctx) => {
  const admin = await requireAdmin(ctx);
  if (!admin) {
    await ctx.reply(ctx.t("errors-only-admins-access"));
    return;
  }

  await ctx.reply(ctx.t("admin-panel-title"), { reply_markup: adminMainMenu });
});

bot.catch(({ error }) => {
  console.error(error);
});
bot.start({
  onStart(botInfo) {
    console.log(`Bot started as https://t.me/${botInfo.username}`);
    startScheduler(bot);
  },
});

import { conversations, createConversation } from "@grammyjs/conversations";
import { I18n } from "@grammyjs/i18n";
import { Bot } from "grammy";
import { eq } from "drizzle-orm";
import { createCircleConversation } from "./conversations/createCircle";
import { subscribeConversation } from "./conversations/subscribe";
import { onboarding } from "./conversations/onboarding";
import { circles } from "./db/schema";
import type { MyContext } from "./lib/context";
import { setCommandsForUser } from "./lib/commands";
import { db } from "./lib/db";
import { requireAdmin, userMiddleware } from "./lib/users";
import { adminMainMenu } from "./menus/admin";

const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

// Configure i18n
const i18n = new I18n<MyContext>({
  defaultLocale: "ar",
  directory: "locales",
  localeNegotiator: (ctx) => ctx.from?.language_code ?? "en",
});

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
  },
});

import { conversations, createConversation } from "@grammyjs/conversations";
import { Bot } from "grammy";
import { eq } from "drizzle-orm";
import { createCircleConversation } from "./conversations/createCircle";
import { subscribeConversation } from "./conversations/subscribe";
import { circles } from "./db/schema";
import type { MyContext } from "./lib/context";
import { db } from "./lib/db";
import { requireAdmin, userMiddleware } from "./lib/users";

const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

const dbMiddleware = async (ctx: MyContext, next: () => Promise<void>) => {
  ctx.db = db;
  return next();
};

bot.use(dbMiddleware);
bot.use(userMiddleware);

bot.use(conversations());
bot.use(createConversation(subscribeConversation, { plugins: [dbMiddleware, userMiddleware] }));
bot.use(createConversation(createCircleConversation, { plugins: [dbMiddleware, userMiddleware] }));

bot.command("start", async (ctx) => {
  await ctx.reply("Hello! Use /subscribe to reserve stocks in the current circle.");
});

bot.command("subscribe", async (ctx) => {
  await ctx.conversation.enter("subscribeConversation");
});

bot.command("create_circle", async (ctx) => {
  const admin = await requireAdmin(ctx);
  if (!admin) {
    await ctx.reply("Only admins can run this command.");
    return;
  }
  await ctx.reply("Starting circle creation wizard...");
  await ctx.conversation.enter("createCircleConversation");
});

bot.command("start_circle", async (ctx) => {
  const admin = await requireAdmin(ctx);
  if (!admin) {
    await ctx.reply("Only admins can start the circle.");
    return;
  }

  const circle = await ctx.db.query.circles.findFirst({
    where: eq(circles.isLocked, false),
    with: { circleMonths: true },
  });

  if (!circle) {
    await ctx.reply("No open circle found. Use /create_circle first.");
    return;
  }

  await ctx.db
    .update(circles as any)
    .set({ isLocked: true })
    .where(eq(circles.id, circle.id));

  const monthCount = circle.circleMonths?.length ?? 0;
  await ctx.reply(
    `Circle "${circle.name}" is now locked. Subscriptions are closed for ${monthCount} month(s).`,
  );
});

bot.catch(({ error }) => {
  console.error(error);
});
bot.start({
  onStart(botInfo) {
    console.log(`Bot started as https://t.me/${botInfo.username}`);
  },
});

import { conversations, createConversation } from "@grammyjs/conversations";
import { Bot } from "grammy";
import { subscribeConversation } from "./conversations/subscribe";
import type { MyContext } from "./lib/context";
import { db } from "./lib/db";

const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

bot.use((ctx, next) => {
  ctx.db = db;
  return next();
});

bot.use(conversations());
bot.use(createConversation(subscribeConversation));

bot.command("start", async (ctx) => {
  await ctx.reply("Hello! Use /subscribe to reserve stocks in the current circle.");
});

bot.command("subscribe", async (ctx) => {
  await ctx.conversation.enter("subscribeConversation");
});

bot.start();

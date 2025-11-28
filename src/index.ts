import { Bot } from "grammy";
import type { MyContext } from "./lib/context";

const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

bot.command("start", (ctx) => {
  ctx.reply("Hello!");
});

bot.start();
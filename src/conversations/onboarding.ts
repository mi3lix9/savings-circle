import { InlineKeyboard, Keyboard } from "grammy";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import type { MyContext, MyConversation } from "../lib/context";

export async function onboarding(conversation: MyConversation, ctx: MyContext) {
  // Step 1: Get Telegram Info
  const user = ctx.from;
  if (!user) {
    await ctx.reply(ctx.t("errors-missing-user-info"));
    return;
  }

  let firstName = user.first_name;
  let lastName = user.last_name || "";
  let phone = "";

  // Step 2: Request Contact
  const contactKeyboard = new Keyboard()
    .requestContact(ctx.t("onboarding-share-phone"))
    .resized()
    .oneTime();

  await ctx.reply(
    ctx.t("onboarding-welcome"),
    { reply_markup: contactKeyboard }
  );

  const contactCtx = await conversation.waitFor("message:contact");
  phone = contactCtx.message?.contact?.phone_number || "";

  // Step 3: Confirm Name
  const nameKeyboard = new InlineKeyboard()
    .text(ctx.t("onboarding-name-correct"), "name_correct")
    .text(ctx.t("onboarding-name-edit"), "name_edit");

  await ctx.reply(
    ctx.t("onboarding-name-confirmation", { firstName, lastName }),
    { parse_mode: "HTML", reply_markup: nameKeyboard }
  );

  const nameCtx = await conversation.waitFor("callback_query:data");
  await nameCtx.answerCallbackQuery();

  if (nameCtx.callbackQuery?.data === "name_edit") {
    await ctx.reply(ctx.t("onboarding-enter-full-name"), {
      reply_markup: { remove_keyboard: true },
    });

    const newNameCtx = await conversation.waitFor("message:text");
    const fullName = newNameCtx.message?.text || "";
    const parts = fullName.trim().split(/\s+/);
    
    if (parts.length > 0) {
        firstName = parts[0] || "";
        lastName = parts.slice(1).join(" ");
    } else {
        firstName = fullName;
        lastName = "";
    }
  } else {
      // Remove the keyboard if they said yes
      await ctx.api.editMessageReplyMarkup(nameCtx.chat!.id, nameCtx.update.callback_query.message!.message_id, { reply_markup: undefined });
  }

  // Step 4: Save to Database
  await conversation.external(async () => {
    // Check if user exists
    const existingUser = await ctx.db.query.users.findFirst({
      where: eq(users.telegramId, user.id.toString()),
    });

    if (existingUser) {
      await ctx.db
        .update(users)
        .set({
          firstName,
          lastName,
          phone,
        })
        .where(eq(users.telegramId, user.id.toString()));
    } else {
      // This case might be rare if middleware creates user, but good to handle
       await ctx.db.insert(users).values({
        telegramId: user.id.toString(),
        firstName,
        lastName,
        phone,
      });
    }
  });

  await ctx.reply(ctx.t("onboarding-thank-you", { firstName }), {
    reply_markup: { remove_keyboard: true },
  });
}

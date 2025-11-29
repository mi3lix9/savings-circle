import type { MyContext } from "./context";

/**
 * Set bot commands for a specific user based on their admin status
 * @param ctx - The context object with i18n support
 * @param userId - The Telegram user ID
 * @param isAdmin - Whether the user is an admin
 */
export async function setCommandsForUser(
  ctx: MyContext,
  userId: number,
  isAdmin: boolean,
): Promise<void> {
  try {
    // User commands (available to all users)
    const userCommands = [
      { command: "start", description: ctx.t("commands-start") },
      { command: "subscribe", description: ctx.t("commands-subscribe") },
      { command: "myturn", description: ctx.t("commands-myturn") },
    ];

    // Admin commands (includes all user commands plus admin-specific ones)
    const adminCommands = [
      { command: "start", description: ctx.t("commands-start") },
      { command: "subscribe", description: ctx.t("commands-subscribe") },
      { command: "myturn", description: ctx.t("commands-myturn") },
      { command: "create_circle", description: ctx.t("commands-create-circle") },
      { command: "start_circle", description: ctx.t("commands-start-circle") },
      { command: "admin", description: ctx.t("commands-admin") },
    ];

    const commands = isAdmin ? adminCommands : userCommands;

    await ctx.api.setMyCommands(commands, {
      scope: {
        type: "chat",
        chat_id: userId,
      },
    });
  } catch (error) {
    // Log error but don't throw to avoid breaking user experience
    console.error(`Failed to set commands for user ${userId}:`, error);
  }
}


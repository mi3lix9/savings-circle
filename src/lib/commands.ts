import type { Api } from "grammy";

// User commands (available to all users)
export const userCommands = [
  { command: "start", description: "Begin registration and see welcome message" },
  { command: "subscribe", description: "Pick months and stocks for the current circle" },
];

// Admin commands (includes all user commands plus admin-specific ones)
export const adminCommands = [
  { command: "start", description: "Begin registration and see welcome message" },
  { command: "subscribe", description: "Pick months and stocks for the current circle" },
  { command: "create_circle", description: "Create a new savings circle" },
  { command: "start_circle", description: "Lock the current circle to start subscriptions" },
  { command: "admin", description: "Open admin panel" },
];

/**
 * Set bot commands for a specific user based on their admin status
 * @param api - The bot API instance (from bot.api or ctx.api)
 * @param userId - The Telegram user ID
 * @param isAdmin - Whether the user is an admin
 */
export async function setCommandsForUser(
  api: Api,
  userId: number,
  isAdmin: boolean,
): Promise<void> {
  try {
    const commands = isAdmin ? adminCommands : userCommands;

    await api.setMyCommands(commands, {
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


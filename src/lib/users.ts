import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { setCommandsForUser } from "./commands";
import type { MyContext } from "./context";

export type UserRecord = typeof users.$inferSelect;

export async function userMiddleware(ctx: MyContext, next: () => Promise<void>) {
  if (!ctx.from) {
    throw new Error("Missing Telegram user information.");
  }
  const telegramId = String(ctx.from.id);

  const existing = await ctx.db.query.users.findFirst({
    where: eq(users.telegramId, telegramId),
  });
  if (existing) {
    ctx.user = existing;
    // Set commands for existing user
    if (ctx.from) {
      await setCommandsForUser(ctx.api, ctx.from.id, existing.isAdmin);
    }
    return next();
  }

  // Check if any users exist - if not, this will be the first user (admin)
  const anyUser = await ctx.db.query.users.findFirst();
  const isAdmin = !anyUser;

  const [created] = await ctx.db
    .insert(users)
    .values({ telegramId, isAdmin })
    .onConflictDoNothing({ target: [users.telegramId] })
    .returning();

  if (!created) {
    throw new Error("Unable to create user record.");
  }
  ctx.user = created;
  // Set commands for newly created user
  if (ctx.from) {
    await setCommandsForUser(ctx.api, ctx.from.id, created.isAdmin);
  }
  return next();
}

export async function requireAdmin(ctx: MyContext): Promise<UserRecord | null> {
  if (ctx.user.isAdmin) {
    return ctx.user;
  }
  return null;
}

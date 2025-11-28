import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import type { MyContext } from "./context";

export type UserRecord = typeof users.$inferSelect;

export async function findOrCreateUser(ctx: MyContext): Promise<UserRecord> {
  if (!ctx.from) {
    throw new Error("Missing Telegram user information.");
  }
  const telegramId = String(ctx.from.id);
  const existing = await ctx.db.query.users.findFirst({
    where: eq(users.telegramId, telegramId),
  });
  if (existing) {
    return existing;
  }

  const [created] = await ctx.db
    .insert(users as any)
    .values({
      telegramId,
    })
    .returning();
  if (!created) {
    throw new Error("Unable to create user record.");
  }
  return created;
}

export async function requireAdmin(ctx: MyContext): Promise<UserRecord | null> {
  const user = await findOrCreateUser(ctx);
  if (user.isAdmin) {
    return user;
  }
  return null;
}

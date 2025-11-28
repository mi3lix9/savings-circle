import type { ConversationFlavor } from "@grammyjs/conversations";
import type { Context } from "grammy";
import type { Database } from "./db";

type BaseContext = Context & {
  db: Database;
};

export type MyContext = ConversationFlavor<BaseContext>;

export type ConversationContext = BaseContext;

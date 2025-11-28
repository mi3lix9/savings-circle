import type { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import type { Context } from "grammy";
import type { Database } from "./db";
import type { UserRecord } from "./users";

export type MyContext = ConversationFlavor<Context> & { db: Database; user: UserRecord };

export type MyConversation = Conversation<MyContext, MyContext>;
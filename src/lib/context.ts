import type { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import type { Context } from "grammy";
import type { Database } from "./db";

export type MyContext = ConversationFlavor<Context> & { db: Database };

export type MyConversation = Conversation<MyContext, MyContext>;
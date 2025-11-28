import type { Context } from "grammy";
import type { Database } from "./db";

export  type MyContext = Context & {
  db: Database;
}
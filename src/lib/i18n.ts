import { I18n } from "@grammyjs/i18n";
import type { MyContext } from "./context";

export const i18n = new I18n<MyContext>({
  defaultLocale: "ar",
  directory: "locales",
  localeNegotiator: (ctx) => ctx.from?.language_code ?? "en",
});



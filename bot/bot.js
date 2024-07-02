import { Bot, InlineKeyboard, InlineQueryResultBuilder } from "grammy";
import storage from "node-persist";
import { config } from "../config/config.js";

const bot = new Bot(config.BOT_TOKEN);

bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard();
  keyboard.webApp("Open my CTRL wallet", config.WEBAPP_URL);
  keyboard.switchInline("Invite contact", "Invite");
  /* TODO allow only selecting personal chats with one other user */

  await ctx.reply("What would you like to do?", { reply_markup: keyboard });
});

bot.inlineQuery("Invite", async (ctx) => {
  const keyboard = new InlineKeyboard().url("Open CTRL", config.TG_APP_URL);

  const result = InlineQueryResultBuilder.article("id-0", "Invite contact to try CTRL", {
    reply_markup: keyboard
  }).text("You've been invited to try the CTRL wallet!");

  await ctx.answerInlineQuery([result], { cache_time: 0 });
});

bot.inlineQuery(/send (\d+(\.\d+)?) SOL/, async (ctx) => {
  const amountSol = ctx.match[1];
  const sendingUserId = ctx.inlineQuery.from.id;
  const sendingUserName = ctx.inlineQuery.from.username;

  const keyboard = new InlineKeyboard().text(
    "Accept",
    "accept-sol:" + sendingUserId + "-" + sendingUserName + "-" + amountSol
  );

  const result = InlineQueryResultBuilder.article("id-0", "Send SOL", {
    reply_markup: keyboard
  }).text("@" + sendingUserName + " wants to send you " + amountSol + " SOL using the CTRL wallet.");

  await ctx.answerInlineQuery([result], { cache_time: 0 });
});

bot.on("callback_query:data", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const [query, param] = callbackData.split(":");
  const callbackUser = ctx.callbackQuery.from.username;

  if (query === "accept-sol") {
    const [sendingUserId, sendingUserName, amountSol] = param.split("-");
    const receivingUserId = ctx.callbackQuery.from.id;

    /* Check if the receiving user already has a wallet */
    const publicKey = await storage.getItem(receivingUserId.toString());

    if (publicKey) {
      /* The receiving user already has a wallet */

      /* 1. Send the original user a message to open the webapp through the bot */
      const message =
        "@" + callbackUser + " has accepted your " +
        amountSol +
        " SOL transfer, please open the webapp using the link below to finalize the transaction.";
      const url = config.TG_APP_URL + "?startapp=" + publicKey + "-" + amountSol;
      const keyboard = new InlineKeyboard().url("Open CTRL", url);
      
      await bot.api.sendMessage(sendingUserId, message, { reply_markup: keyboard });

      /* 2. Edit original inline query message sent to receiving user */
      const inlineMessageId = ctx.callbackQuery.inline_message_id;

      try {      
        await ctx.api.editMessageText(
          undefined,
          undefined,
          "Thank you for accepting the transfer! You will receive your SOL once @" + sendingUserName +
            " finalizes the transaction.",
          { inline_message_id: inlineMessageId }
        );
        await ctx.answerCallbackQuery({ text: "User has a wallet. Message edited successfully" });
      } catch (error) {
        await ctx.answerCallbackQuery({ text: "User has a wallet. Failed to edit message." });
      }
    } else {
      /* The receiving user does NOT have a wallet */
      /* Edit original inline query message send to receiving user to be an invite */
      const keyboard = new InlineKeyboard().url("Open CTRL", config.TG_APP_URL);

      const inlineMessageId = ctx.callbackQuery.inline_message_id;
      const inlineMessageText = "";
      try {
        await ctx.api.editMessageText(
          undefined,
          undefined,
          inlineMessageText +
            " Looks like you do not have a CTRL wallet yet! Please open the CTRL app using the link below and create a wallet before you can start accepting SOL transactions.",
          { inline_message_id: inlineMessageId, reply_markup: keyboard }
        );
        await ctx.answerCallbackQuery({ text: "User does not have a wallet. Message edited successfully." });
      } catch (error) {
        await ctx.answerCallbackQuery({ text: "User does not have a wallet. Failed to edit message." });
      }
    }
  }
});

export default bot;

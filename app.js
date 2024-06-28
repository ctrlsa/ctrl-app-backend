import closeWithGrace from "close-with-grace";
import Fastify from "fastify";
import autoLoad from "@fastify/autoload";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
import { Bot, InlineKeyboard, InlineQueryResultBuilder } from "grammy";
import storage from "node-persist";

import { config } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pass --options via CLI arguments in command to enable these options.
const options = {};

const app = Fastify({ logger: true });

const bot = new Bot(config.BOT_TOKEN);

app.register(autoLoad, {
  dir: path.join(__dirname, "plugins"),
  options: Object.assign({}, options)
});

app.register(fastifyStatic, {
  root: path.join(process.cwd(), config.PUBLIC_DIR),
  prefix: "/"
});

// Receive webhook updates on path https://example.com/<BOT-TOKEN>
//app.post("/" + config.BOT_TOKEN, webhookCallback(bot, "fastify", { secretToken: config.SECRET_TOKEN }));

// delay is the number of milliseconds for the graceful close to finish
const closeListeners = closeWithGrace(
  { delay: process.env.FASTIFY_CLOSE_GRACE_DELAY || 500 },
  // eslint-disable-next-line no-unused-vars
  async function ({ signal, err, manual }) {
    if (err) {
      app.log.error(err);
    }
    await app.close();
  }
);

app.addHook("onClose", async (instance, done) => {
  closeListeners.uninstall();
  done();
});

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

/* TODO enforce numeric SOL amount. Do we have a max/min? Are we allowing decimals? */
/* TODO error handling */
bot.inlineQuery(/send (.*) SOL/, async (ctx) => {

  const amountSol = ctx.match[1];
  const sendingUserId = ctx.inlineQuery.from.id;
  
  const keyboard = new InlineKeyboard().text("Accept", "accept-sol:" + sendingUserId + "-" + amountSol);

  const result = InlineQueryResultBuilder
   .article("id-0", "Send SOL", { reply_markup: keyboard })
   .text(/* TODO username + */" wants to send you " + amountSol + " SOL using the CTRL wallet.");

  await ctx.answerInlineQuery(
    [result],
    { cache_time: 0 },
  );
});

bot.on('callback_query:data', async (ctx) => {

  const callbackData = ctx.callbackQuery.data;
  const [query, param] = callbackData.split(':');

  if (query === 'accept-sol') {
    const [sendingUserId, amountSol] = param.split('-');
    const receivingUserId = ctx.callbackQuery.from.id;

    /* Check if the receiving user already has a wallet */
    const publicKey = await storage.getItem(receivingUserId.toString());

    if (publicKey) { /* The receiving user already has a wallet */

      /* 1. Send the original user a message to open the webapp through the bot */
      const message = /* TODO username + */ ' has accepted your ' + amountSol + ' SOL transfer, please open the webapp using the link below to finalize the transaction.';
      const url = config.TG_APP_URL + "?startapp=" + publicKey + "-" + amountSol;
      const keyboard = new InlineKeyboard().url("Open CTRL", url);

      try {
        await bot.api.sendMessage(sendingUserId, message, { reply_markup: keyboard });
      } catch (error) {
        /* TODO handle error */
      }

      /* 2. Edit original inline query message sent to receiving user */
      const inlineMessageId = ctx.callbackQuery.inline_message_id;

      try {
        await ctx.api.editMessageText(
          undefined,
          undefined,
          "Thank you for accepting the transfer! You will receive your SOL once " /* + TODO username */ + " finalizes the transaction.",
          { inline_message_id: inlineMessageId }
        );
        await ctx.answerCallbackQuery({ text: 'User has a wallet.' });
      } catch (error) {
        /* TODO handle error */
        await ctx.answerCallbackQuery({ text: 'Failed to edit message.' });
      }
    }
    else { /* The receiving user does NOT have a wallet */
      /* Edit original inline query message send to receiving user to be an invite */
      const keyboard = new InlineKeyboard().url("Open CTRL", config.TG_APP_URL);
      try {
        await ctx.api.editMessageText(
          undefined,
          undefined,
          inlineMessageText + " Looks like you do not have a CTRL wallet yet! Please open the CTRL app using the link below and create a wallet before you can start accepting SOL transactions.",
          { inline_message_id: inlineMessageId, reply_markup: keyboard }
        );
        await ctx.answerCallbackQuery({ text: 'User does not have a wallet.' });
      } catch (error) {
        /* TODO handle error */
        await ctx.answerCallbackQuery({ text: 'Failed to edit message.' });
      }
    }
  }

});

// Default route
app.setNotFoundHandler((_, reply) => {
  reply.code(404).send("NOT FOUND");
});

// POST /user/key
app.post("/user/key", async (request, reply) => {
  try {
    const { userId, publicKey } = request.body;
    if (!userId || !publicKey) {
      return reply.code(400).send("Need to send userId and publicKey in the body of the request");
    }

    await storage.setItem(userId, publicKey);

    if ((await storage.getItem(userId)) !== publicKey) {
      return reply.code(500).send("Could not save key for user");
    }

    // Created
    return reply.code(201).send();
  } catch (err) {
    console.error(err);
    return reply.code(500).send("Internal server error");
  }
});

const startServer = async () => {
  try {
    await app.listen({ port: config.APP_PORT, host: config.APP_HOST }, async (error) => {
      if (error) {
        console.error(error);
        process.exit(1);
      }

      await bot.start();
      console.log("Bot started");
      //await bot.api.setWebhook(config.WEBHOOK_URL + config.BOT_TOKEN, { secret_token: config.SECRET_TOKEN });
    });

    console.log("Server listening on " + config.APP_PORT);

    await storage.init({ dir: config.STORAGE_PATH });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

startServer();

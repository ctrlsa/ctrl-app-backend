import closeWithGrace from "close-with-grace";
import Fastify from "fastify";
import autoLoad from "@fastify/autoload";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
import { Bot, InlineKeyboard, InlineQueryResultBuilder } from "grammy";
import storage from 'node-persist';

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
  keyboard.switchInline("Invite contact");

  await ctx.reply("What would you like to do?", { reply_markup: keyboard });
});

bot.on("inline_query", async (ctx) => {

  const keyboard = new InlineKeyboard().url("Open CTRL", config.TG_APP_URL);

  const result = InlineQueryResultBuilder
   .article("id-0", "Invite contact to try CTRL", { reply_markup: keyboard })
   .text("You've been invited to try the CTRL wallet!");

  await ctx.answerInlineQuery(
    [result],
    { cache_time: 0 },
  );
});

/* TODO add default route */
app.get('/add-user-key/*', async function handler (request, reply) {

  /* TODO probably better to put userId and publicKey in a JSON object in the body */
  /* TODO security issues with sending it like this? */
  /* TODO how can we only accept api requests from our webapp, not just anywhere? */

  var urlParts = request.url.split("/");
  if (urlParts.length < 4) {
    return reply.code(400).send();
    // TODO: more verbose error
  }
  var userId = urlParts[2];
  var publicKey = urlParts[3];
  // TODO validations for bad userId and bad publicKey?

  await storage.setItem(userId, publicKey);

  var savedPublicKey = await storage.getItem(userId);
  if (savedPublicKey !== publicKey) {
    return reply.code(500).send();
    // TODO more verbose error
  }

  return reply.code(200).send();
})

const startServer = async () => {
  try {
    await app.listen({ port: config.APP_PORT, host: config.APP_HOST }, async (error) => {
      await bot.start();
      console.log("Bot started");
      //await bot.api.setWebhook(config.WEBHOOK_URL + config.BOT_TOKEN, { secret_token: config.SECRET_TOKEN });
    });

    console.log("Server listening on " + config.APP_PORT);

    await storage.init({dir: "../ctrl-data/users-keys/"}); // TODO: take this out into a var

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

startServer();

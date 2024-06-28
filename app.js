import api from "./api/api.js";
import bot from "./bot/bot.js";
import { config } from "./config/config.js";
import storage from "node-persist";

const startServer = async () => {
  try {
    await api.listen({ port: config.APP_PORT, host: config.APP_HOST }, async (error) => {
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

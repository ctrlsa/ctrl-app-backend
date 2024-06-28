import dotenv from "dotenv";

dotenv.config();

const APP_HOST = process.env.WEBAPP_HOST || "0.0.0.0";
const APP_PORT = process.env.WEBAPP_PORT || 3000;
const WEBAPP_URL = process.env.WEBAPP_URL || ""; // Webapp url
const TG_APP_URL = process.env.TG_APP_URL || ""; // Telegram web app url (from BotFather)
const BOT_TOKEN = process.env.BOT_TOKEN || ""; // Add your token from Telegram's BotFather
const SECRET_TOKEN = process.env.SECRET_TOKEN || "";
const PUBLIC_DIR = process.env.PUBLIC_DIR || "public";
const SPA_FILENAME = process.env.SPA_FILENAME || "index.html";
const STORAGE_PATH = process.env.STORAGE_PATH || "storage";

export const config = {
  APP_HOST,
  APP_PORT,
  WEBAPP_URL,
  TG_APP_URL,
  BOT_TOKEN,
  SECRET_TOKEN,
  PUBLIC_DIR,
  SPA_FILENAME,
  STORAGE_PATH
};

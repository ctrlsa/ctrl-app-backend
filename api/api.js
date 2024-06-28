import Fastify from "fastify";
import closeWithGrace from "close-with-grace";
import autoLoad from "@fastify/autoload";
import fastifyStatic from "@fastify/static";
import path from "path";
import storage from "node-persist";
import { fileURLToPath } from "url";
import { config } from "../config/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pass --options via CLI arguments in command to enable these options.
const options = {};

const api = Fastify({ logger: true });

api.register(autoLoad, {
  dir: path.join(__dirname, "../plugins"),
  options: Object.assign({}, options)
});

api.register(fastifyStatic, {
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
      api.log.error(err);
    }
    await api.close();
  }
);

api.addHook("onClose", async (instance, done) => {
  closeListeners.uninstall();
  done();
});

// Default route
api.setNotFoundHandler((_, reply) => {
  reply.code(404).send("NOT FOUND");
});

// POST /user/key
api.post("/user/key", async (request, reply) => {
  try {
    const { userId, publicKey } = request.body;
    if (!userId || !publicKey) {
      return reply
        .code(400)
        .send({ message: "Need to send userId and publicKey in the body of the request" });
    }

    const uid = userId.toString();
    const pk = publicKey.toString();

    await storage.setItem(uid, pk);

    if ((await storage.getItem(uid)) !== pk) {
      return reply.code(500).send({ message: "Could not save key for user" });
    }

    // Created
    return reply.code(201).send();
  } catch (err) {
    console.error(err);
    return reply.code(500).send({ message: "Internal server error" });
  }
});

export default api;

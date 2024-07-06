import { test } from "tap";
import createApi from "./api.js";
import storage from "node-persist";

test("test post /user/key", async (t) => {
  await storage.init({ dir: "test-storage" });
  const api = await createApi();
  const response = await api.inject({
    method: "POST",
    url: "/user/key",
    payload: { userId: "1", publicKey: "1" }
  });
  t.equal(response.statusCode, 201);
  t.end();
});

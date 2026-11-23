import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import Save from "../../save-model.js";
const base = "http://127.0.0.1:3000",
  password = randomBytes(24).toString("base64url");
async function api(path, { method = "GET", body, token } = {}) {
  return fetch(base + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
assert.equal((await api("/health")).status, 200);
const signup = await api("/v1/auth/register", {
  method: "POST",
  body: { email: "container@example.com", password, nickname: "VPS Test" },
});
assert.equal(signup.status, 201);
const account = await signup.json();
const save = await api("/v1/me/progress", {
  method: "PUT",
  token: account.token,
  body: {
    baseRevision: 0,
    mutationId: randomUUID(),
    data: Save.normalize({ totalKills: 2 }),
  },
});
assert.equal(save.status, 200);
assert.equal(
  (await (await api("/v1/me", { token: account.token })).json()).progress.data
    .totalKills,
  2,
);
assert.equal(
  (await api("/v1/auth/logout", { method: "POST", token: account.token }))
    .status,
  204,
);
assert.equal((await api("/v1/me", { token: account.token })).status, 401);
console.log(
  "PASS Docker API + PostgreSQL: health, cadastro, save, leitura e revogação de sessão",
);

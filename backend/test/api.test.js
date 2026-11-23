import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture } from "./helpers.js";
import Save from "../../save-model.js";
import { migrate } from "../src/database.js";
let app, db, account, initialMutation;
const password = "Uma senha longa para testes 2026";
const auth = (token) => ({ authorization: "Bearer " + token });
before(async () => {
  ({ app, db } = await fixture());
  account = (
    await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "Alpha@Example.com", password, nickname: "Alpha" },
    })
  ).json();
});
after(async () => {
  await app?.close();
});
test("Migrations are repeatable and health checks the database", async () => {
  await migrate(db);
  assert.equal((await app.inject("/health")).statusCode, 200);
});
test("Registration normalizes email and never exposes credentials", async () => {
  assert.equal(account.user.email, "alpha@example.com");
  assert.equal(account.progress.revision, 0);
  assert.equal(account.token.length, 43);
  const row = (
    await db.query("SELECT password_hash FROM users WHERE id=$1", [
      account.user.id,
    ])
  ).rows[0];
  assert.match(row.password_hash, /^scrypt\$65536\$8\$2\$/);
  assert(!JSON.stringify(account).includes("password_hash"));
  const session = (
    await db.query("SELECT token_hash FROM sessions WHERE user_id=$1", [
      account.user.id,
    ])
  ).rows[0];
  assert.notEqual(session.token_hash, account.token);
});
test("Weak passwords, unsafe nickname and extra account fields are rejected", async () => {
  for (const payload of [
    { email: "new@example.com", password: "short", nickname: "New" },
    { email: "new@example.com", password, nickname: "<script>" },
    { email: "new@example.com", password, nickname: "New", isAdmin: true },
  ])
    assert.equal(
      (await app.inject({ method: "POST", url: "/v1/auth/register", payload }))
        .statusCode,
      400,
    );
});
test("Duplicate email is rejected case-insensitively", async () => {
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: { email: "ALPHA@example.com", password, nickname: "Other" },
      })
    ).statusCode,
    409,
  );
});
test("Login returns the same error for missing account and wrong password", async () => {
  const replies = [];
  for (const email of ["missing@example.com", "alpha@example.com"]) {
    const result = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: "Outra senha errada mas longa" },
    });
    assert.equal(result.statusCode, 401);
    replies.push(result.json());
  }
  assert.deepEqual(replies[0], replies[1]);
});
test("Protected routes require a valid session", async () => {
  assert.equal((await app.inject("/v1/me")).statusCode, 401);
  assert.equal(
    (await app.inject({ url: "/v1/me", headers: auth("A".repeat(43)) }))
      .statusCode,
    401,
  );
});
test("A second account cannot read or overwrite another profile", async () => {
  const beta = (
    await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "beta@example.com", password, nickname: "Beta" },
    })
  ).json();
  const result = await app.inject({
    method: "PATCH",
    url: "/v1/me/profile",
    headers: auth(beta.token),
    payload: { nickname: "New Beta", id: account.user.id },
  });
  assert.equal(result.statusCode, 400);
  assert.equal(
    (await app.inject({ url: "/v1/me", headers: auth(account.token) })).json()
      .user.nickname,
    "Alpha",
  );
  assert.equal(
    (await app.inject({ url: "/v1/me", headers: auth(beta.token) })).json()
      .progress.data.totalKills,
    0,
  );
});
test("Profile changes are private and returned safely", async () => {
  const result = await app.inject({
    method: "PATCH",
    url: "/v1/me/profile",
    headers: auth(account.token),
    payload: { nickname: "Alpha Novo" },
  });
  assert.equal(result.statusCode, 200);
  assert.equal(result.json().user.nickname, "Alpha Novo");
  assert.equal(result.headers["cache-control"], "no-store");
});
test("Progress saves have revisions and idempotent retry", async () => {
  const body = {
    baseRevision: 0,
    mutationId: randomUUID(),
    data: Save.normalize({ totalKills: 7, totalCapas: 2 }),
  };
  initialMutation = body;
  const one = await app.inject({
    method: "PUT",
    url: "/v1/me/progress",
    headers: auth(account.token),
    payload: body,
  });
  assert.equal(one.statusCode, 200);
  const two = await app.inject({
    method: "PUT",
    url: "/v1/me/progress",
    headers: auth(account.token),
    payload: body,
  });
  assert.deepEqual(two.json(), one.json());
  assert.equal(two.json().progress.revision, 1);
  const reused = await app.inject({
    method: "PUT",
    url: "/v1/me/progress",
    headers: auth(account.token),
    payload: { ...body, data: Save.normalize({ totalKills: 8 }) },
  });
  assert.equal(reused.statusCode, 409);
});
test("Stale device gets conflict without overwriting cloud state", async () => {
  const result = await app.inject({
    method: "PUT",
    url: "/v1/me/progress",
    headers: auth(account.token),
    payload: {
      baseRevision: 0,
      mutationId: randomUUID(),
      data: Save.normalize({ totalKills: 99 }),
    },
  });
  assert.equal(result.statusCode, 409);
  assert.equal(result.json().error.code, "PROGRESS_CONFLICT");
  assert.equal(result.json().error.progress.data.totalKills, 7);
});
test("Two concurrent writes cannot silently overwrite each other", async () => {
  const results = await Promise.all(
    [8, 9].map((totalKills) =>
      app.inject({
        method: "PUT",
        url: "/v1/me/progress",
        headers: auth(account.token),
        payload: {
          baseRevision: 1,
          mutationId: randomUUID(),
          data: Save.normalize({ totalKills }),
        },
      }),
    ),
  );
  assert.deepEqual(
    results.map((result) => result.statusCode).sort(),
    [200, 409],
  );
});
test("Idempotent retry also reports newer cloud data", async () => {
  const response = await app.inject({
    method: "PUT",
    url: "/v1/me/progress",
    headers: auth(account.token),
    payload: initialMutation,
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().progress.revision, 1);
  assert.equal(response.json().current.revision, 2);
});
test("Invalid progress and unknown fields are rejected", async () => {
  for (const data of [
    { ...Save.normalize(), totalCapas: 2 },
    { ...Save.normalize(), coins: 1000 },
    { ...Save.normalize(), sens: 100 },
  ])
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: "/v1/me/progress",
          headers: auth(account.token),
          payload: { baseRevision: 2, mutationId: randomUUID(), data },
        })
      ).statusCode,
      400,
    );
});
test("CORS permits the game and rejects other origins", async () => {
  const headers = {
    origin: "https://heitormtsantos.github.io",
    "access-control-request-method": "GET",
    "access-control-request-headers": "authorization",
  };
  const yes = await app.inject({ method: "OPTIONS", url: "/v1/me", headers });
  assert.equal(yes.statusCode, 204);
  assert.equal(yes.headers["access-control-allow-origin"], headers.origin);
  const no = await app.inject({
    url: "/health",
    headers: { origin: "https://evil.example" },
  });
  assert.equal(no.statusCode, 403);
});
test("Password change rotates session and invalidates previous login", async () => {
  const login = (
    await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "alpha@example.com", password },
    })
  ).json();
  const changed = await app.inject({
    method: "POST",
    url: "/v1/me/password",
    headers: auth(login.token),
    payload: { currentPassword: password, newPassword: password + " nova" },
  });
  assert.equal(changed.statusCode, 200);
  assert.equal(
    (await app.inject({ url: "/v1/me", headers: auth(account.token) }))
      .statusCode,
    401,
  );
  assert.equal(
    (await app.inject({ url: "/v1/me", headers: auth(changed.json().token) }))
      .statusCode,
    200,
  );
  account = changed.json();
});
test("Logout revokes the server-side session", async () => {
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/v1/auth/logout",
        headers: auth(account.token),
      })
    ).statusCode,
    204,
  );
  assert.equal(
    (await app.inject({ url: "/v1/me", headers: auth(account.token) }))
      .statusCode,
    401,
  );
});
test("Expired sessions are rejected", async () => {
  const login = (
    await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "alpha@example.com", password: password + " nova" },
    })
  ).json();
  await db.query(
    "UPDATE sessions SET expires_at=now()-interval '1 day' WHERE user_id=$1",
    [login.user.id],
  );
  assert.equal(
    (await app.inject({ url: "/v1/me", headers: auth(login.token) }))
      .statusCode,
    401,
  );
});
test("Authentication requests are rate-limited", async () => {
  const isolated = await fixture({ authMax: 2 });
  try {
    for (let i = 0; i < 2; i++)
      await isolated.app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: { email: "nobody@example.com", password },
      });
    assert.equal(
      (
        await isolated.app.inject({
          method: "POST",
          url: "/v1/auth/login",
          payload: { email: "nobody@example.com", password },
        })
      ).statusCode,
      429,
    );
  } finally {
    await isolated.app.close();
  }
});

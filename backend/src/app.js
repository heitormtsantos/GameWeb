import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import Save from "../../save-model.js";
import {
  hashPassword,
  verifyPassword,
  digest,
  newToken,
  tokenFrom,
} from "./security.js";
import { readConfig } from "./config.js";

const fields = {
  email: {
    type: "string",
    minLength: 3,
    maxLength: 254,
    pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
  },
  password: { type: "string", minLength: 12, maxLength: 128 },
  nickname: {
    type: "string",
    minLength: 2,
    maxLength: 24,
    pattern: "^[\\p{L}\\p{N} _.-]+$",
  },
  remember: { type: "boolean" },
};
const object = (properties, required = Object.keys(properties)) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});
function fail(status, code, message, extra = {}) {
  const error = new Error(message);
  error.statusCode = status;
  error.code = code;
  error.extra = extra;
  throw error;
}
const userView = (user) => ({
  id: user.id,
  email: user.email,
  nickname: user.nickname,
  createdAt: user.created_at,
});
const stateView = (row) => ({
  revision: row.revision,
  data: row.data,
  updatedAt: row.updated_at,
});

export async function buildApp({
  db,
  config = readConfig(),
  logger = false,
} = {}) {
  if (!db) throw new Error("Database is required");
  const app = Fastify({
    logger: logger
      ? {
          redact: [
            "req.headers.authorization",
            "req.body.password",
            "req.body.currentPassword",
            "req.body.newPassword",
          ],
        }
      : false,
    bodyLimit: 24576,
    trustProxy: config.trustProxy,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  });
  const dummyHash = await hashPassword("dummy-password-" + randomUUID());
  app.decorateRequest("account", null);
  await app.register(cors, {
    origin(origin, cb) {
      if (!origin || config.origins.includes(origin)) cb(null, true);
      else {
        const error = new Error("Origem não permitida.");
        error.statusCode = 403;
        error.code = "ORIGIN_NOT_ALLOWED";
        cb(error);
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: false,
    maxAge: 600,
  });
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
  });
  app.addHook("onSend", async (request, reply, payload) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer");
    return payload;
  });
  app.setErrorHandler((error, request, reply) => {
    const status = error.validation ? 400 : error.statusCode || 500;
    if (status >= 500)
      request.log.error(
        { err: error, requestId: request.id },
        "Request failed",
      );
    reply.code(status).send({
      error: {
        code: error.validation
          ? "INVALID_INPUT"
          : status >= 500
            ? "INTERNAL_ERROR"
            : error.code || "REQUEST_FAILED",
        message: error.validation
          ? "Revise os campos informados."
          : status === 429
            ? "Muitas tentativas. Aguarde e tente novamente."
            : status >= 500
              ? "Não foi possível concluir agora."
              : error.message,
        ...error.extra,
      },
    });
  });
  async function authenticate(request) {
    const token = tokenFrom(request);
    if (!token) fail(401, "UNAUTHORIZED", "Entre na sua conta para continuar.");
    const result = await db.query(
      "SELECT u.id,u.email,u.nickname,u.created_at,s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",
      [digest(token)],
    );
    if (!result.rows.length)
      fail(401, "SESSION_EXPIRED", "Sua sessão expirou. Entre novamente.");
    request.account = result.rows[0];
  }
  async function issueSession(tx, user, remember) {
    const token = newToken(),
      expiresAt = new Date(
        Date.now() +
          1000 * (remember ? config.rememberSeconds : config.sessionSeconds),
      );
    await tx.query("DELETE FROM sessions WHERE expires_at<=now()");
    await tx.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)",
      [digest(token), user.id, expiresAt],
    );
    await tx.query(
      "DELETE FROM sessions WHERE user_id=$1 AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=$1 ORDER BY created_at DESC,token_hash LIMIT 5)",
      [user.id],
    );
    const saved = await tx.query(
      "SELECT * FROM player_state WHERE user_id=$1",
      [user.id],
    );
    return {
      token,
      expiresAt,
      user: userView(user),
      progress: stateView(saved.rows[0]),
    };
  }
  const authRoute = {
    rateLimit: { max: config.authMax, timeWindow: "15 minutes" },
  };
  app.get("/health", async () => {
    await db.query("SELECT 1");
    return { status: "ok", service: "gameweb-api", version: "1.0.0" };
  });
  app.post(
    "/v1/auth/register",
    {
      config: authRoute,
      schema: {
        body: object(
          {
            email: fields.email,
            password: fields.password,
            nickname: fields.nickname,
            remember: fields.remember,
          },
          ["email", "password", "nickname"],
        ),
      },
    },
    async (request, reply) => {
      const email = request.body.email.trim().toLowerCase(),
        nickname = request.body.nickname.trim();
      if (nickname.length < 2)
        fail(
          400,
          "INVALID_INPUT",
          "Informe um apelido com pelo menos 2 caracteres.",
        );
      const hash = await hashPassword(request.body.password);
      try {
        return await db.transaction(async (tx) => {
          const user = (
            await tx.query(
              "INSERT INTO users(id,email,nickname,password_hash) VALUES($1,$2,$3,$4) RETURNING *",
              [randomUUID(), email, nickname, hash],
            )
          ).rows[0];
          await tx.query(
            "INSERT INTO player_state(user_id,data) VALUES($1,$2::jsonb)",
            [user.id, JSON.stringify(Save.normalize())],
          );
          reply.code(201);
          return issueSession(tx, user, request.body.remember);
        });
      } catch (error) {
        if (error.code === "23505")
          fail(
            409,
            "ACCOUNT_EXISTS",
            "Não foi possível criar a conta com este e-mail. Tente entrar.",
          );
        throw error;
      }
    },
  );
  app.post(
    "/v1/auth/login",
    {
      config: authRoute,
      schema: {
        body: object(
          {
            email: fields.email,
            password: fields.password,
            remember: fields.remember,
          },
          ["email", "password"],
        ),
      },
    },
    async (request) => {
      const user = (
        await db.query("SELECT * FROM users WHERE email=$1", [
          request.body.email.trim().toLowerCase(),
        ])
      ).rows[0];
      const valid = await verifyPassword(
        request.body.password,
        user?.password_hash || dummyHash,
      );
      if (!user || !valid)
        fail(401, "INVALID_CREDENTIALS", "E-mail ou senha incorretos.");
      return db.transaction((tx) =>
        issueSession(tx, user, request.body.remember),
      );
    },
  );
  app.post(
    "/v1/auth/logout",
    { preHandler: authenticate },
    async (request, reply) => {
      await db.query("DELETE FROM sessions WHERE token_hash=$1", [
        request.account.token_hash,
      ]);
      return reply.code(204).send();
    },
  );
  app.get("/v1/me", { preHandler: authenticate }, async (request) => ({
    user: userView(request.account),
    progress: stateView(
      (
        await db.query("SELECT * FROM player_state WHERE user_id=$1", [
          request.account.id,
        ])
      ).rows[0],
    ),
  }));
  app.patch(
    "/v1/me/profile",
    {
      preHandler: authenticate,
      schema: { body: object({ nickname: fields.nickname }) },
    },
    async (request) => {
      const nickname = request.body.nickname.trim();
      if (nickname.length < 2)
        fail(400, "INVALID_INPUT", "Informe um apelido válido.");
      return {
        user: userView(
          (
            await db.query(
              "UPDATE users SET nickname=$1,updated_at=now() WHERE id=$2 RETURNING *",
              [nickname, request.account.id],
            )
          ).rows[0],
        ),
      };
    },
  );
  app.post(
    "/v1/me/password",
    {
      preHandler: authenticate,
      config: authRoute,
      schema: {
        body: object({
          currentPassword: fields.password,
          newPassword: fields.password,
        }),
      },
    },
    async (request) => {
      const user = (
        await db.query("SELECT * FROM users WHERE id=$1", [request.account.id])
      ).rows[0];
      if (
        !(await verifyPassword(
          request.body.currentPassword,
          user.password_hash,
        ))
      )
        fail(401, "INVALID_CREDENTIALS", "A senha atual está incorreta.");
      const hash = await hashPassword(request.body.newPassword);
      return db.transaction(async (tx) => {
        await tx.query(
          "UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2",
          [hash, user.id],
        );
        await tx.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
        return issueSession(tx, user, false);
      });
    },
  );
  app.put(
    "/v1/me/progress",
    {
      preHandler: authenticate,
      schema: {
        body: object({
          baseRevision: { type: "integer", minimum: 0, maximum: 2147483646 },
          mutationId: {
            type: "string",
            pattern:
              "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
          },
          data: Save.schema,
        }),
      },
    },
    async (request) => {
      const { baseRevision, mutationId, data } = request.body;
      if (!Save.consistent(data))
        fail(400, "INVALID_PROGRESS", "O progresso informado é inconsistente.");
      const canonical = Save.normalize(data),
        hash = digest(JSON.stringify({ baseRevision, data: canonical }));
      return db.transaction(async (tx) => {
        const current = (
          await tx.query(
            "SELECT * FROM player_state WHERE user_id=$1 FOR UPDATE",
            [request.account.id],
          )
        ).rows[0];
        const previous = (
          await tx.query(
            "SELECT request_hash,response FROM progress_writes WHERE user_id=$1 AND mutation_id=$2",
            [request.account.id, mutationId],
          )
        ).rows[0];
        if (previous) {
          if (previous.request_hash !== hash)
            fail(
              409,
              "MUTATION_REUSED",
              "Esta operação já foi usada com outro conteúdo.",
            );
          return current.revision > previous.response.progress.revision
            ? { ...previous.response, current: stateView(current) }
            : previous.response;
        }
        if (current.revision !== baseRevision)
          fail(
            409,
            "PROGRESS_CONFLICT",
            "Há progresso mais recente em outro dispositivo.",
            { progress: stateView(current) },
          );
        const row = (
          await tx.query(
            "UPDATE player_state SET revision=revision+1,data=$1::jsonb,updated_at=now() WHERE user_id=$2 AND revision=$3 RETURNING *",
            [JSON.stringify(canonical), request.account.id, baseRevision],
          )
        ).rows[0];
        const response = { progress: stateView(row) };
        await tx.query(
          "INSERT INTO progress_writes(user_id,mutation_id,request_hash,response) VALUES($1,$2,$3,$4::jsonb)",
          [request.account.id, mutationId, hash, JSON.stringify(response)],
        );
        await tx.query(
          "DELETE FROM progress_writes WHERE user_id=$1 AND mutation_id NOT IN (SELECT mutation_id FROM progress_writes WHERE user_id=$1 ORDER BY created_at DESC,mutation_id LIMIT 100)",
          [request.account.id],
        );
        return response;
      });
    },
  );
  app.addHook("onClose", async () => {
    await db.close();
  });
  return app;
}

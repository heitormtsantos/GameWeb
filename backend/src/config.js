export function readConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  const fallback = production
    ? "https://heitormtsantos.github.io"
    : "https://heitormtsantos.github.io,http://localhost:8000,http://127.0.0.1:8000";
  const origins = (env.ALLOWED_ORIGINS || fallback)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    !origins.length ||
    origins.some((value) => {
      try {
        const url = new URL(value);
        return (
          url.origin !== value ||
          !["https:", "http:"].includes(url.protocol) ||
          (production &&
            url.protocol !== "https:" &&
            !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
        );
      } catch {
        return true;
      }
    })
  )
    throw new Error(
      "ALLOWED_ORIGINS must list explicit origins; public production origins require HTTPS.",
    );
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("Invalid PORT");
  return {
    port,
    host: env.HOST || "0.0.0.0",
    origins,
    production,
    trustProxy: env.TRUST_PROXY === "true" ? 1 : false,
    authMax: 10,
    sessionSeconds: 43200,
    rememberSeconds: 604800,
  };
}

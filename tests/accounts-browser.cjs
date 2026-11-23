const { chromium } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
let api,
  apiUrl = "",
  front;
const contexts = [];
const password = "Uma frase segura para jogar 2026";
const checks = [];
function pass(name) {
  checks.push(name);
  console.log("PASS contas:", name);
}
(async () => {
  const { fixture } = await import("../backend/test/helpers.js");
  front = http.createServer((request, response) => {
    const route = new URL(request.url, "http://localhost").pathname;
    if (route === "/account-config.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(
        "window.ArenaAccountConfig={apiBaseUrl:" +
          JSON.stringify(apiUrl) +
          "};",
      );
      return;
    }
    const target = path.resolve(
      root,
      "." + (route === "/" ? "/index.html" : route),
    );
    if (!target.startsWith(root + path.sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    fs.readFile(target, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.setHeader(
        "Content-Type",
        target.endsWith(".js")
          ? "text/javascript"
          : target.endsWith(".css")
            ? "text/css"
            : "text/html",
      );
      response.end(data);
    });
  });
  await new Promise((resolve) => front.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + front.address().port;
  ({ app: api } = await fixture({ origins: [origin] }));
  apiUrl = await api.listen({ host: "127.0.0.1", port: 0 });
  const browser = await chromium.launch({
    channel:
      process.env.ARENA_BROWSER === "chromium"
        ? "chromium"
        : process.env.ARENA_BROWSER || "chrome",
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const errors = [];
  try {
    async function page(guest = false) {
      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 950 },
      });
      contexts.push(ctx);
      if (guest)
        await ctx.addInitScript(() =>
          localStorage.setItem(
            "ff_web_apex2_v1",
            JSON.stringify({ totalKills: 3 }),
          ),
        );
      const p = await ctx.newPage();
      p.setDefaultTimeout(15000);
      p.on("pageerror", (error) => errors.push(error.message));
      await p.goto(origin);
      await p.waitForFunction(
        () => document.querySelectorAll(".mode-btn").length === 6,
      );
      return p;
    }
    async function signup(p, email, nickname) {
      await p.click("#btnAccount");
      await p.click("#accountRegisterTab");
      await p.fill("#registerEmail", email);
      await p.fill("#registerNickname", nickname);
      await p.fill("#registerPassword", password);
      await p.fill("#registerPasswordConfirm", password);
      await p.click("#accountRegister button[type=submit]");
      await p.waitForSelector("#accountProfile:not([hidden])");
    }
    async function login(p, email, pass = password) {
      await p.click("#btnAccount");
      await p.fill("#loginEmail", email);
      await p.fill("#loginPassword", pass);
      await p.click("#accountLogin button[type=submit]");
      await p.waitForSelector("#accountProfile:not([hidden])");
    }
    async function saved(p) {
      await p.waitForFunction(
        () =>
          document.getElementById("syncStatus").textContent ===
          "Progresso salvo online.",
      );
    }
    async function logout(p) {
      if (!(await p.locator("#accountModal").isVisible()))
        await p.click("#btnAccount");
      await p.click("#accountLogout");
      await p.waitForSelector("#accountAuth:not([hidden])");
      await p.click("#accountClose");
    }
    const a = await page(true);
    assert.equal(await a.locator("#svKills").textContent(), "3");
    await signup(a, "alpha@example.com", "Alpha");
    assert.equal(await a.locator("#svKills").textContent(), "0");
    assert.equal(await a.locator("#accountImport").isVisible(), true);
    pass("Cadastro não importa automaticamente o progresso de visitante");
    await a.click("#accountImport");
    await saved(a);
    assert.equal(await a.locator("#svKills").textContent(), "3");
    assert.equal(await a.locator("#accountImport").isVisible(), false);
    pass("Importação explícita preenche somente a conta vazia");
    await a.fill("#profileNickname", "Alpha Novo");
    await a.click("#accountProfileForm button");
    await a.waitForFunction(
      () => document.getElementById("btnAccount").textContent === "Alpha Novo",
    );
    await a.click("#accountClose");
    await a.selectOption("#skinColorSel", "0xdc2626");
    await saved(a);
    const b = await page();
    await login(b, "alpha@example.com");
    assert.equal(await b.locator("#btnAccount").textContent(), "Alpha Novo");
    assert.equal(await b.locator("#svKills").textContent(), "3");
    assert.equal(await b.inputValue("#skinColorSel"), "0xdc2626");
    await b.click("#accountClose");
    pass("Outro dispositivo carrega perfil, aparência e estatísticas online");
    await a.context().setOffline(true);
    await a.selectOption("#skinColorSel", "0x2563eb");
    await a.waitForFunction(() =>
      document
        .getElementById("syncStatus")
        .textContent.startsWith("Sem conexão"),
    );
    await a.context().setOffline(false);
    await a.evaluate(() => window.dispatchEvent(new Event("online")));
    await saved(a);
    pass("Alterações offline são recuperadas na reconexão");
    await b.selectOption("#skinColorSel", "0x15803d");
    await b.waitForFunction(() =>
      document
        .getElementById("syncStatus")
        .textContent.includes("outro dispositivo"),
    );
    await b.click("#btnAccount");
    assert.equal(await b.locator("#accountConflict").isVisible(), true);
    await b.click("#useOnline");
    await saved(b);
    assert.equal(await b.inputValue("#skinColorSel"), "0x2563eb");
    await b.click("#accountClose");
    pass("Conflito preserva as duas versões e permite escolher a online");
    await a.selectOption("#skinColorSel", "0xd97706");
    await saved(a);
    await b.selectOption("#skinColorSel", "0x7c3aed");
    await b.waitForFunction(() =>
      document
        .getElementById("syncStatus")
        .textContent.includes("outro dispositivo"),
    );
    await b.click("#btnAccount");
    await b.click("#useDevice");
    await saved(b);
    await b.click("#accountClose");
    await a.reload();
    await a.waitForFunction(
      () =>
        document.getElementById("syncStatus").textContent ===
        "Progresso salvo online.",
    );
    assert.equal(await a.inputValue("#skinColorSel"), "0x7c3aed");
    pass("A escolha do progresso do dispositivo persiste após recarregar");
    await logout(a);
    assert.equal(await a.locator("#svKills").textContent(), "3");
    await signup(a, "beta@example.com", "Beta");
    assert.equal(await a.locator("#svKills").textContent(), "0");
    await a.click("#accountClose");
    await logout(a);
    await login(a, "alpha@example.com");
    assert.equal(await a.locator("#svKills").textContent(), "3");
    assert.equal(await a.inputValue("#skinColorSel"), "0x7c3aed");
    pass("Trocar de conta não mistura caches e restaura o visitante original");
    await a.click("#accountClose");
    await a.context().setOffline(true);
    await a.selectOption("#skinColorSel", "0xd97706");
    await a.waitForFunction(() =>
      document
        .getElementById("syncStatus")
        .textContent.startsWith("Sem conexão"),
    );
    await a.context().setOffline(false);
    await a.reload();
    await saved(a);
    assert.equal(await a.inputValue("#skinColorSel"), "0xd97706");
    pass("Pendência de envio sobrevive ao recarregamento");
    await b.reload();
    await saved(b);
    let dropResponse = true;
    await a.route(apiUrl + "/v1/me/progress", async (route) => {
      if (dropResponse && route.request().method() === "PUT") {
        dropResponse = false;
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await a.selectOption("#skinColorSel", "0xdc2626");
    await a.waitForFunction(() =>
      document
        .getElementById("syncStatus")
        .textContent.startsWith("Sem conexão"),
    );
    await b.selectOption("#skinColorSel", "0x15803d");
    await b.waitForFunction(() =>
      document
        .getElementById("syncStatus")
        .textContent.includes("outro dispositivo"),
    );
    await b.click("#btnAccount");
    await b.click("#useDevice");
    await saved(b);
    await b.click("#accountClose");
    await a.reload();
    await a.waitForFunction(() =>
      document
        .getElementById("syncStatus")
        .textContent.includes("outro dispositivo"),
    );
    await a.click("#btnAccount");
    await a.click("#useOnline");
    await saved(a);
    assert.equal(await a.inputValue("#skinColorSel"), "0x15803d");
    await a.click("#accountClose");
    await a.unroute(apiUrl + "/v1/me/progress");
    pass(
      "Resposta perdida não sobrescreve progresso mais recente ao repetir a operação",
    );
    await a.click("#btnAccount");
    await a.locator("#accountProfile .account-password summary").click();
    await a.fill("#currentPassword", password);
    await a.fill("#newPassword", password + " nova");
    await a.click("#accountPassword button");
    await a.waitForFunction(() =>
      document
        .getElementById("accountMessage")
        .textContent.includes("Senha alterada"),
    );
    pass("Troca de senha funciona pela interface de perfil");
    await b.selectOption("#skinColorSel", "0xdc2626");
    await b.waitForFunction(() =>
      document
        .getElementById("syncStatus")
        .textContent.startsWith("Sessão expirada"),
    );
    pass("Senha alterada revoga a sessão de outro dispositivo");
    await a.screenshot({
      path: path.join(root, "test-results", "account-profile.png"),
    });
    assert.deepEqual(errors, []);
    pass("Nenhuma exceção JavaScript na integração com a API real");
    fs.writeFileSync(
      path.join(root, "test-results", "accounts-results.json"),
      JSON.stringify({ checks }, null, 2),
    );
  } finally {
    await browser.close();
    await api.close();
    front.close();
  }
})().catch(async (error) => {
  console.error(error);
  if (api) await api.close().catch(() => {});
  front?.close();
  process.exitCode = 1;
});

/* Cross-device casual progress. No account token is included in the game save. */
window.ArenaAccounts = (() => {
  "use strict";
  const SAVE = "ff_web_apex2_v1",
    AUTH = "block-arena:session:v1";
  const equal = (a, b) =>
    JSON.stringify(ArenaSave.normalize(a)) ===
    JSON.stringify(ArenaSave.normalize(b));
  function getRecord(storage, key) {
    try {
      return JSON.parse(storage.getItem(key) || "null");
    } catch {
      return null;
    }
  }
  function putRecord(storage, key, value) {
    try {
      value
        ? storage.setItem(key, JSON.stringify(value))
        : storage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
  function endpoint(value) {
    if (!value) return "";
    try {
      const url = new URL(value);
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/"
      )
        return "";
      if (
        url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        )
      )
        return "";
      return url.origin;
    } catch {
      return "";
    }
  }
  function create({
    apiBaseUrl = "",
    adapter,
    timeout = 6000,
    debounce = 1200,
  }) {
    const storage = (name) => {
        try {
          return window[name];
        } catch {
          return null;
        }
      },
      tabStore = storage("sessionStorage"),
      persistentStore = storage("localStorage");
    const base = endpoint(apiBaseUrl),
      listeners = new Set();
    let session = null,
      user = null,
      validated = false,
      revision = 0,
      latest = null,
      pending = null,
      dirty = false,
      conflict = null,
      status = "guest",
      message = "",
      booting = false,
      busy = false,
      sending = null,
      timer = null,
      epoch = 0;
    const guest = () => ArenaSave.normalize(ArenaRuntime.loadSave(SAVE, ""));
    const cacheKey = (id) => "block-arena:pending:" + id;
    const view = () => ({
      configured: !!base,
      user,
      authenticated: !!session && validated && status !== "expired",
      status,
      message,
      booting,
      busy,
      revision,
      conflict: conflict ? { online: conflict.data, local: latest } : null,
      canImport:
        !!session &&
        validated &&
        revision === 0 &&
        !dirty &&
        !pending &&
        !conflict &&
        !equal(guest(), ArenaSave.normalize()),
    });
    const emit = () => {
      for (const fn of listeners) fn(view());
    };
    function setStatus(next, text = "") {
      status = next;
      message = text;
      emit();
    }
    function cache() {
      if (user)
        ArenaRuntime.save(cacheKey(user.id), {
          revision,
          pending,
          latest,
          dirty,
        });
    }
    function credentials() {
      if (!session) return;
      const saved = putRecord(
        session.remember ? persistentStore : tabStore,
        AUTH,
        session,
      );
      putRecord(session.remember ? tabStore : persistentStore, AUTH, null);
      if (!saved)
        ArenaUI.notice(
          "O navegador não permitiu manter a sessão. A conta continuará aberta nesta página.",
        );
    }
    function ensureIdle() {
      if (!adapter.canApply())
        throw new Error(
          "Volte ao lobby para trocar de conta ou carregar outro progresso.",
        );
    }
    async function request(
      path,
      { method = "GET", body, token = session?.token } = {},
    ) {
      if (!base)
        throw new Error("As contas online ainda não estão disponíveis.");
      const controller = new AbortController(),
        cancel = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(base + path, {
          method,
          signal: controller.signal,
          cache: "no-store",
          credentials: "omit",
          headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: "Bearer " + token } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data =
          response.status === 204
            ? {}
            : await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(
            data.error?.message || "Não foi possível concluir agora.",
          );
          error.status = response.status;
          error.code = data.error?.code;
          error.progress = data.error?.progress;
          throw error;
        }
        return data;
      } catch (error) {
        if (!error.status) {
          error.network = true;
          error.message =
            "Sem conexão com as contas. Suas alterações continuam salvas neste dispositivo.";
        }
        throw error;
      } finally {
        clearTimeout(cancel);
      }
    }
    function expire() {
      validated = false;
      session = null;
      putRecord(tabStore, AUTH, null);
      putRecord(persistentStore, AUTH, null);
      setStatus(
        "expired",
        "Sua sessão expirou. Entre novamente para sincronizar.",
      );
    }
    function apply(data, id) {
      ArenaRuntime.setSaveScope(id);
      adapter.apply(ArenaSave.normalize(data));
    }
    function schedule() {
      clearTimeout(timer);
      if (session && validated && !conflict)
        timer = setTimeout(() => flush().catch(() => {}), debounce);
    }
    function queueSave(data) {
      if (!user) return;
      const normalized = ArenaSave.normalize(data);
      if (latest && equal(latest, normalized)) return;
      latest = normalized;
      dirty = true;
      cache();
      if (status !== "expired" && !conflict)
        setStatus("pending", "Alterações salvas neste dispositivo.");
      schedule();
    }
    async function flush() {
      clearTimeout(timer);
      if (sending) return sending;
      if (!session || !validated || conflict || (!dirty && !pending)) return;
      if (!pending) {
        pending = {
          baseRevision: revision,
          mutationId: crypto.randomUUID(),
          data: ArenaSave.normalize(latest),
        };
        cache();
      }
      const operation = pending,
        ownEpoch = epoch;
      setStatus("saving");
      sending = (async () => {
        try {
          const result = await request("/v1/me/progress", {
            method: "PUT",
            body: operation,
          });
          if (ownEpoch !== epoch) return;
          if (
            result.current &&
            result.current.revision > result.progress.revision
          ) {
            conflict = result.current;
            dirty = true;
            cache();
            setStatus(
              "conflict",
              "Há progresso mais recente em outro dispositivo.",
            );
            return;
          }
          revision = result.progress.revision;
          pending = null;
          dirty = !equal(latest, operation.data);
          cache();
          setStatus(dirty ? "pending" : "saved");
        } catch (error) {
          if (ownEpoch !== epoch) return;
          if (error.code === "PROGRESS_CONFLICT") {
            conflict = error.progress;
            cache();
            setStatus("conflict", error.message);
          } else if (error.status === 401) expire();
          else {
            cache();
            setStatus(error.network ? "offline" : "error", error.message);
          }
          throw error;
        } finally {
          sending = null;
          if (ownEpoch === epoch && dirty && !conflict && status === "pending")
            schedule();
        }
      })();
      return sending;
    }
    async function adopt(result, remember) {
      user = result.user;
      session = {
        token: result.token || session?.token,
        expiresAt: result.expiresAt || session?.expiresAt,
        user,
        remember,
      };
      validated = true;
      const cached = ArenaRuntime.loadSave(cacheKey(user.id)),
        remote = result.progress;
      revision = Number.isInteger(cached.revision)
        ? cached.revision
        : remote.revision;
      pending = cached.pending?.mutationId ? cached.pending : null;
      dirty = !!cached.dirty || !!pending;
      conflict = null;
      latest = dirty
        ? ArenaSave.normalize(cached.latest || pending?.data)
        : ArenaSave.normalize(remote.data);
      if (!dirty) revision = remote.revision;
      credentials();
      ArenaRuntime.setSaveScope(user.id);
      if (adapter.canApply()) apply(latest, user.id);
      else if (!equal(adapter.snapshot(), latest)) {
        latest = ArenaSave.normalize(adapter.snapshot());
        dirty = true;
        conflict = remote;
      }
      cache();
      setStatus(conflict ? "conflict" : dirty ? "pending" : "saved");
      if (dirty && !conflict) await flush().catch(() => {});
    }
    async function authenticate(kind, body) {
      ensureIdle();
      busy = true;
      emit();
      try {
        const result = await request("/v1/auth/" + kind, {
          method: "POST",
          body,
          token: null,
        });
        epoch++;
        await adopt(result, !!body.remember);
      } finally {
        busy = false;
        emit();
      }
    }
    async function start() {
      const stored =
        getRecord(tabStore, AUTH) || getRecord(persistentStore, AUTH);
      if (!base || !stored?.token || !stored.user?.id) return;
      if (
        !/^[A-Za-z0-9_-]{43}$/.test(stored.token) ||
        !(Date.parse(stored.expiresAt) > Date.now())
      ) {
        putRecord(tabStore, AUTH, null);
        putRecord(persistentStore, AUTH, null);
        setStatus("expired", "Entre novamente para carregar sua conta.");
        return;
      }
      session = stored;
      booting = true;
      adapter.bootBusy(true);
      setStatus("loading");
      try {
        const result = await request("/v1/me");
        await adopt(
          { ...result, token: stored.token, expiresAt: stored.expiresAt },
          !!stored.remember,
        );
      } catch (error) {
        if (error.status === 401) expire();
        else {
          user = stored.user;
          const cached = ArenaRuntime.loadSave(cacheKey(user.id));
          revision = cached.revision || 0;
          pending = cached.pending || null;
          dirty = !!cached.dirty || !!pending;
          latest = ArenaSave.normalize(
            cached.latest || ArenaRuntime.loadSave(SAVE, user.id),
          );
          apply(latest, user.id);
          setStatus("offline", error.message);
        }
      } finally {
        booting = false;
        adapter.bootBusy(false);
        emit();
      }
    }
    async function retry() {
      if (!session) return;
      if (!validated) {
        busy = true;
        emit();
        try {
          const result = await request("/v1/me");
          await adopt(
            { ...result, token: session.token, expiresAt: session.expiresAt },
            session.remember,
          );
        } catch (error) {
          if (error.status === 401) expire();
          else setStatus("offline", error.message);
        } finally {
          busy = false;
          emit();
        }
      } else return flush();
    }
    async function logout() {
      ensureIdle();
      if (busy || sending)
        throw new Error("Aguarde a sincronização em andamento.");
      const old = session;
      epoch++;
      clearTimeout(timer);
      session = null;
      user = null;
      validated = false;
      pending = null;
      latest = null;
      dirty = false;
      conflict = null;
      putRecord(tabStore, AUTH, null);
      putRecord(persistentStore, AUTH, null);
      apply(guest(), "");
      setStatus("guest");
      if (old)
        await request("/v1/auth/logout", {
          method: "POST",
          token: old.token,
        }).catch(() => {});
    }
    async function updateProfile(nickname) {
      if (!session || !validated)
        throw new Error("Entre novamente para editar seu perfil.");
      const result = await request("/v1/me/profile", {
        method: "PATCH",
        body: { nickname },
      });
      user = result.user;
      session.user = user;
      credentials();
      emit();
    }
    async function changePassword(currentPassword, newPassword) {
      if (!session || !validated)
        throw new Error("Entre novamente para alterar a senha.");
      const result = await request("/v1/me/password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      session = {
        ...session,
        token: result.token,
        expiresAt: result.expiresAt,
      };
      credentials();
      emit();
    }
    async function importGuest() {
      ensureIdle();
      if (!view().canImport)
        throw new Error(
          "A importação está disponível apenas para uma conta sem progresso.",
        );
      latest = guest();
      dirty = true;
      apply(latest, user.id);
      cache();
      return flush();
    }
    async function resolveConflict(choice) {
      ensureIdle();
      if (!conflict) return;
      revision = conflict.revision;
      pending = null;
      const online = conflict.data;
      conflict = null;
      if (choice === "online") {
        latest = ArenaSave.normalize(online);
        dirty = false;
        apply(latest, user.id);
        cache();
        setStatus("saved");
      } else {
        dirty = true;
        cache();
        await flush();
      }
    }
    window.addEventListener("online", () => retry().catch(() => {}));
    window.addEventListener("pagehide", cache);
    return {
      view,
      subscribe(fn) {
        listeners.add(fn);
        fn(view());
        return () => listeners.delete(fn);
      },
      start,
      authenticate,
      queueSave,
      flush,
      retry,
      logout,
      updateProfile,
      changePassword,
      importGuest,
      resolveConflict,
    };
  }
  return { create };
})();

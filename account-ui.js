window.ArenaAccountUI = (() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  function init(account) {
    let busy = false,
      mode = "login";
    const modal = $("accountModal");
    function close() {
      if (busy) return;
      modal.classList.add("hidden");
      $("btnAccount").focus();
    }
    function showForm(next) {
      mode = next;
      $("accountLogin").hidden = mode !== "login";
      $("accountRegister").hidden = mode !== "register";
      $("accountError").textContent = "";
      $("accountLoginTab").setAttribute(
        "aria-selected",
        String(mode === "login"),
      );
      $("accountRegisterTab").setAttribute(
        "aria-selected",
        String(mode === "register"),
      );
    }
    function render(state) {
      const logged = !!state.user && state.status !== "expired";
      $("btnAccount").textContent = logged ? state.user.nickname : "Entrar";
      $("accountProfile").hidden = !logged;
      $("accountAuth").hidden = logged || !state.configured;
      $("accountUnavailable").hidden = state.configured;
      $("accountTitle").textContent = logged
        ? "Seu perfil"
        : "Sua conta na arena";
      $("progressScope").textContent = logged
        ? "PROGRESSO DA SUA CONTA"
        : "PROGRESSO NESTE NAVEGADOR";
      const labels = {
        guest:
          "Jogue como visitante ou entre para levar seu progresso a outros dispositivos.",
        loading: "Carregando sua conta…",
        saved: "Progresso salvo online.",
        pending: "Alterações salvas neste dispositivo. Aguardando envio.",
        saving: "Salvando progresso online…",
        offline: "Sem conexão. Progresso salvo neste dispositivo.",
        conflict: "Há progresso mais recente em outro dispositivo.",
        expired: "Sessão expirada. Entre novamente para sincronizar.",
        error: state.message,
      };
      $("syncStatus").textContent = state.configured
        ? labels[state.status] || state.message
        : "Jogue como visitante. O progresso fica salvo neste navegador.";
      $("accountSyncStatus").textContent =
        labels[state.status] || state.message;
      if (logged) {
        $("profileEmail").textContent = state.user.email;
        $("profileCreatedAt").textContent = new Date(
          state.user.createdAt,
        ).toLocaleDateString("pt-BR");
        if (document.activeElement !== $("profileNickname"))
          $("profileNickname").value = state.user.nickname;
      }
      $("accountImport").hidden = !state.canImport;
      $("accountConflict").hidden = !state.conflict;
      if (state.conflict) {
        $("conflictOnline").textContent =
          `Online: ${state.conflict.online.totalKills} abates, ${state.conflict.online.totalBooyahs} vitórias`;
        $("conflictLocal").textContent =
          `Neste dispositivo: ${state.conflict.local.totalKills} abates, ${state.conflict.local.totalBooyahs} vitórias`;
      }
      $("accountRetry").hidden = !["offline", "error", "pending"].includes(
        state.status,
      );
      for (const button of modal.querySelectorAll(
        'button[type="submit"],#accountImport,#accountRetry,#accountLogout,#useOnline,#useDevice',
      ))
        button.disabled = busy || state.busy || state.booting;
      if (state.status === "expired" && state.user)
        $("loginEmail").value = state.user.email;
    }
    async function action(fn, success) {
      if (busy) return;
      busy = true;
      $("accountError").textContent = "";
      render(account.view());
      try {
        await fn();
        if (success) $("accountMessage").textContent = success;
      } catch (error) {
        $("accountError").textContent = error.message;
      } finally {
        busy = false;
        render(account.view());
      }
    }
    $("btnAccount").onclick = () => {
      modal.classList.remove("hidden");
      $("accountMessage").textContent = "";
      showForm("login");
      render(account.view());
      if (account.view().configured && !account.view().user)
        $("loginEmail").focus();
      else $("accountClose").focus();
    };
    $("accountClose").onclick = close;
    $("accountLoginTab").onclick = () => showForm("login");
    $("accountRegisterTab").onclick = () => showForm("register");
    $("accountLogin").onsubmit = (event) => {
      event.preventDefault();
      const body = {
        email: $("loginEmail").value.trim(),
        password: $("loginPassword").value,
        remember: $("loginRemember").checked,
      };
      action(async () => {
        await account.authenticate("login", body);
        $("loginPassword").value = "";
      }, "Conta carregada.");
    };
    $("accountRegister").onsubmit = (event) => {
      event.preventDefault();
      if ($("registerPassword").value !== $("registerPasswordConfirm").value) {
        $("accountError").textContent = "As senhas precisam ser iguais.";
        return;
      }
      action(async () => {
        await account.authenticate("register", {
          email: $("registerEmail").value.trim(),
          nickname: $("registerNickname").value.trim(),
          password: $("registerPassword").value,
          remember: $("registerRemember").checked,
        });
        $("registerPassword").value = $("registerPasswordConfirm").value = "";
      }, "Conta criada. Seu progresso online está pronto.");
    };
    $("accountProfileForm").onsubmit = (event) => {
      event.preventDefault();
      const nickname = $("profileNickname").value.trim();
      action(() => account.updateProfile(nickname), "Apelido atualizado.");
    };
    $("accountPassword").onsubmit = (event) => {
      event.preventDefault();
      action(async () => {
        await account.changePassword(
          $("currentPassword").value,
          $("newPassword").value,
        );
        $("currentPassword").value = $("newPassword").value = "";
      }, "Senha alterada. As outras sessões foram encerradas.");
    };
    $("accountLogout").onclick = () =>
      action(
        () => account.logout(),
        "Você saiu da conta. O modo visitante foi restaurado.",
      );
    $("accountImport").onclick = () =>
      action(
        () => account.importGuest(),
        "Progresso de visitante importado para esta conta.",
      );
    $("accountRetry").onclick = () => action(() => account.retry());
    $("useOnline").onclick = () =>
      action(
        () => account.resolveConflict("online"),
        "Progresso online carregado.",
      );
    $("useDevice").onclick = () =>
      action(
        () => account.resolveConflict("device"),
        "Progresso deste dispositivo enviado.",
      );
    document.addEventListener(
      "keydown",
      (event) => {
        if (modal.classList.contains("hidden")) return;
        if (event.code === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          close();
          return;
        }
        if (event.code === "Tab") {
          const nodes = [
            ...modal.querySelectorAll("button,input,select"),
          ].filter((item) => !item.disabled && item.getClientRects().length);
          const first = nodes[0],
            last = nodes.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      },
      true,
    );
    account.subscribe(render);
    showForm("login");
    return { close };
  }
  return { init };
})();

(() => {
  const redirectUrl = "https://luizcordeiro04.github.io/snake-game/";
  const config = window.SNAKE_SUPABASE;
  const callbackParams = new URLSearchParams(window.location.hash.slice(1));
  const queryParams = new URLSearchParams(window.location.search);
  const callbackType = callbackParams.get("type") || queryParams.get("type");
  const client = config?.url && config?.publishableKey && window.supabase?.createClient?.(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  const authScreen = document.getElementById("authScreen");
  const authMessage = document.getElementById("authMessage");
  const menuNotice = document.getElementById("menuAuthNotice");
  const guestRow = document.getElementById("accountGuest");
  const userRow = document.getElementById("accountUser");
  const nicknameEl = document.getElementById("playerNickname");
  const accountScreen = document.getElementById("accountScreen");
  const accountMessage = document.getElementById("accountMessage");
  const accountNickname = document.getElementById("accountNickname");
  const accountEmail = document.getElementById("accountEmail");
  const accountBestScore = document.getElementById("accountBestScore");
  const currentNickname = document.getElementById("currentNickname");
  const accountViews = {
    overview: document.getElementById("accountOverview"),
    nickname: document.getElementById("nicknameView"),
  };
  const views = {
    login: document.getElementById("loginView"),
    signup: document.getElementById("signupView"),
    recovery: document.getElementById("recoveryView"),
    reset: document.getElementById("resetView"),
    signupSuccess: document.getElementById("signupSuccessView"),
    unconfirmed: document.getElementById("unconfirmedView"),
  };
  let currentView = "login";
  let profileRequest = 0;
  let recoveryIntent = callbackType === "recovery";

  function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.hidden = !message;
    element.classList.toggle("is-error", isError);
  }

  function showView(name) {
    currentView = name;
    Object.entries(views).forEach(([key, view]) => { view.hidden = key !== name; });
    showMessage(authMessage, "");
    document.getElementById("closeAuthButton").hidden = name === "signupSuccess" || name === "unconfirmed";
    authScreen.classList.add("is-visible");
    (views[name].querySelector("input") || views[name].querySelector("button"))?.focus();
  }

  function closeAuth() {
    authScreen.classList.remove("is-visible");
    showMessage(authMessage, "");
  }

  function showAccountView(name) {
    Object.entries(accountViews).forEach(([key, view]) => { view.hidden = key !== name; });
    showMessage(accountMessage, "");
    if (name === "nickname") {
      currentNickname.textContent = accountNickname.textContent;
      document.querySelector('#nicknameForm input[name="nickname"]').value = "";
      document.querySelector('#nicknameForm input[name="nickname"]').focus();
    }
  }

  function closeAccount() {
    accountScreen.classList.remove("is-visible");
    showAccountView("overview");
    document.getElementById("openAccountButton").focus();
  }

  function friendlyError(error, action) {
    const code = error?.code;
    if (code === "invalid_credentials") return "E-mail ou senha incorretos.";
    if (code === "email_not_confirmed") return "Confirme seu e-mail antes de entrar.";
    if (code === "weak_password") return "Use ao menos 8 caracteres, com maiúscula, minúscula e número.";
    if (code === "email_exists" || code === "user_already_exists") return "Este e-mail já pode estar cadastrado. Tente entrar ou recuperar a senha.";
    if (code === "email_address_invalid" || code === "validation_failed") return "Confira os dados informados e tente novamente.";
    if (code?.includes("rate_limit")) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    if (code === "email_address_not_authorized") return "Não foi possível enviar o e-mail. Tente novamente mais tarde.";
    if (action === "signup" && (code === "unexpected_failure" || code === "database_error")) {
      return "Não foi possível criar a conta. O nickname pode estar em uso; tente outro.";
    }
    if (action === "reset") return "Não foi possível trocar a senha. O link pode ter expirado; solicite outro.";
    return "Não foi possível concluir a operação. Verifique sua conexão e tente novamente.";
  }

  function validPassword(password) {
    return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
  }

  async function submit(form, action) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    showMessage(authMessage, "");
    try {
      await action(new FormData(form));
    } catch (error) {
      showMessage(authMessage, friendlyError(error, form.id === "signupForm" ? "signup" : form.id === "resetForm" ? "reset" : "other"), true);
    } finally {
      button.disabled = false;
    }
  }

  async function syncAccount(session) {
    const request = ++profileRequest;
    if (!session?.user) {
      guestRow.hidden = false;
      userRow.hidden = true;
      nicknameEl.textContent = "";
      accountScreen.classList.remove("is-visible");
      accountNickname.textContent = "—";
      accountEmail.textContent = "—";
      accountBestScore.textContent = "—";
      return false;
    }
    guestRow.hidden = true;
    userRow.hidden = false;
    nicknameEl.textContent = "Conta conectada";
    accountEmail.textContent = session.user.email || "—";
    const { data, error } = await client.from("player_profiles")
      .select("nickname,best_score").eq("id", session.user.id).maybeSingle();
    if (request !== profileRequest) return;
    if (error || !data?.nickname) {
      showMessage(menuNotice, "Conta conectada, mas não foi possível carregar o perfil.", true);
      return false;
    }
    nicknameEl.textContent = data.nickname;
    accountNickname.textContent = data.nickname;
    accountBestScore.textContent = String(data.best_score);
    return true;
  }

  document.getElementById("openLoginButton").addEventListener("click", () => {
    if (!client) {
      showMessage(menuNotice, "Conta indisponível no momento. Você ainda pode jogar.", true);
      return;
    }
    showView("login");
  });
  document.getElementById("showSignupButton").addEventListener("click", () => showView("signup"));
  document.getElementById("showRecoveryButton").addEventListener("click", () => showView("recovery"));
  document.getElementById("signupToLoginButton").addEventListener("click", () => showView("login"));
  document.getElementById("recoveryToLoginButton").addEventListener("click", () => showView("login"));
  document.getElementById("closeAuthButton").addEventListener("click", closeAuth);
  document.getElementById("signupSuccessOkButton").addEventListener("click", () => {
    document.querySelectorAll('#signupForm input[type="password"]').forEach((input) => { input.value = ""; });
    closeAuth();
    document.getElementById("openLoginButton").focus();
  });
  document.getElementById("unconfirmedOkButton").addEventListener("click", () => {
    document.querySelector('#loginForm input[name="password"]').value = "";
    closeAuth();
    document.getElementById("openLoginButton").focus();
  });

  authScreen.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape" && !["reset", "signupSuccess", "unconfirmed"].includes(currentView)) closeAuth();
  });

  document.getElementById("signupForm").addEventListener("submit", (event) => {
    event.preventDefault();
    submit(event.currentTarget, async (values) => {
      const nickname = String(values.get("nickname")).trim();
      const email = String(values.get("email")).trim();
      const password = String(values.get("password"));
      if (!/^[A-Za-z0-9_]{3,20}$/.test(nickname)) {
        showMessage(authMessage, "Nickname: 3 a 20 letras, números ou _.", true);
        return;
      }
      if (!validPassword(password)) {
        showMessage(authMessage, "Use ao menos 8 caracteres, com maiúscula, minúscula e número.", true);
        return;
      }
      if (password !== values.get("confirmPassword")) {
        showMessage(authMessage, "As senhas não coincidem.", true);
        return;
      }
      const { data, error } = await client.auth.signUp({
        email, password, options: { data: { nickname }, emailRedirectTo: redirectUrl },
      });
      if (error) throw error;
      if (data.session) {
        closeAuth();
        showMessage(menuNotice, "Conta criada. Você já pode jogar.");
      } else {
        document.getElementById("signupSuccessEmail").textContent = email;
        showView("signupSuccess");
      }
    });
  });

  document.getElementById("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    submit(event.currentTarget, async (values) => {
      const { error } = await client.auth.signInWithPassword({
        email: String(values.get("email")).trim(),
        password: String(values.get("password")),
      });
      if (error?.code === "email_not_confirmed") {
        showView("unconfirmed");
        return;
      }
      if (error) throw error;
      closeAuth();
      showMessage(menuNotice, "Login realizado.");
    });
  });

  document.getElementById("recoveryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    submit(event.currentTarget, async (values) => {
      const { error } = await client.auth.resetPasswordForEmail(String(values.get("email")).trim(), {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
      closeAuth();
      showMessage(menuNotice, "Se houver uma conta para este e-mail, enviaremos um link de recuperação.");
    });
  });

  document.getElementById("resetForm").addEventListener("submit", (event) => {
    event.preventDefault();
    submit(event.currentTarget, async (values) => {
      const password = String(values.get("password"));
      if (!validPassword(password)) {
        showMessage(authMessage, "Use ao menos 8 caracteres, com maiúscula, minúscula e número.", true);
        return;
      }
      if (password !== values.get("confirmPassword")) {
        showMessage(authMessage, "As senhas não coincidem.", true);
        return;
      }
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      recoveryIntent = false;
      closeAuth();
      window.history.replaceState(null, "", window.location.pathname);
      showMessage(menuNotice, "Senha atualizada com sucesso.");
    });
  });

  document.getElementById("openAccountButton").addEventListener("click", async () => {
    if (!client) return;
    showAccountView("overview");
    accountScreen.classList.add("is-visible");
    document.getElementById("changeNicknameButton").focus();
    try {
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) throw error || new Error("Missing user");
      if (!await syncAccount({ user: data.user })) {
        showMessage(accountMessage, "Não foi possível atualizar os dados da conta. Tente novamente.", true);
      }
    } catch {
      showMessage(accountMessage, "Não foi possível atualizar os dados da conta. Tente novamente.", true);
    }
  });
  document.getElementById("closeAccountButton").addEventListener("click", closeAccount);
  document.getElementById("backToAccountButton").addEventListener("click", () => {
    showAccountView("overview");
    document.getElementById("changeNicknameButton").focus();
  });
  document.getElementById("changeNicknameButton").addEventListener("click", () => showAccountView("nickname"));
  for (const id of ["changeEmailButton", "changePasswordButton", "deleteAccountButton"]) {
    document.getElementById(id).addEventListener("click", () => {
      showMessage(accountMessage, "Função ainda não disponível nesta versão de desenvolvimento.");
    });
  }
  accountScreen.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") closeAccount();
  });
  document.getElementById("nicknameForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const nickname = String(new FormData(form).get("nickname")).trim();
    showMessage(accountMessage, "");
    if (!/^[A-Za-z0-9_]{3,20}$/.test(nickname)) {
      showMessage(accountMessage, "Nickname: 3 a 20 letras, números ou _.", true);
      return;
    }
    button.disabled = true;
    try {
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) throw authError || new Error("Missing user");
      const { data, error } = await client.from("player_profiles")
        .update({ nickname }).eq("id", authData.user.id).select("nickname").single();
      if (error) {
        if (error.code === "23505") {
          showMessage(accountMessage, "Este nickname já está em uso.", true);
          return;
        }
        if (error.code === "23514") {
          showMessage(accountMessage, "Nickname: 3 a 20 letras, números ou _.", true);
          return;
        }
        throw error;
      }
      ++profileRequest;
      nicknameEl.textContent = data.nickname;
      accountNickname.textContent = data.nickname;
      currentNickname.textContent = data.nickname;
      window.dispatchEvent(new Event("snake:nickname-updated"));
      showAccountView("overview");
      showMessage(accountMessage, "Nickname atualizado.");
    } catch {
      showMessage(accountMessage, "Não foi possível salvar. Verifique sua conexão e tente novamente.", true);
    } finally {
      button.disabled = false;
    }
  });
  document.getElementById("logoutButton").addEventListener("click", async () => {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) showMessage(accountMessage, friendlyError(error, "logout"), true);
    else {
      closeAccount();
      document.getElementById("playButton").focus();
      showMessage(menuNotice, "Você saiu da conta.");
    }
  });

  if (!client) return;

  window.SNAKE_AUTH = Object.freeze({
    getSession: () => client.auth.getSession(),
    submitScore: (body) => client.functions.invoke("submit-score", { body }),
  });

  if (callbackParams.has("error") || queryParams.has("error")) {
    showMessage(menuNotice, "O link de e-mail é inválido ou expirou. Solicite um novo link.", true);
  }

  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      recoveryIntent = true;
      showView("reset");
    }
    if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "PASSWORD_RECOVERY") {
      setTimeout(() => {
        syncAccount(session).catch(() => {
          showMessage(menuNotice, "Conta conectada, mas não foi possível carregar o perfil.", true);
        });
      }, 0);
    }
    if (event === "SIGNED_IN" && !recoveryIntent && callbackType === "signup") {
      showMessage(menuNotice, "E-mail confirmado. Bem-vindo!");
    }
  });
})();

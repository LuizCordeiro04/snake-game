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
  const currentAccountEmail = document.getElementById("currentAccountEmail");
  const accountPasswordForm = document.getElementById("accountPasswordForm");
  const passwordReauthForm = document.getElementById("passwordReauthForm");
  const accountViews = {
    overview: document.getElementById("accountOverview"),
    nickname: document.getElementById("nicknameView"),
    email: document.getElementById("emailView"),
    emailPending: document.getElementById("emailPendingView"),
    password: document.getElementById("passwordView"),
    passwordReauth: document.getElementById("passwordReauthView"),
    passwordSuccess: document.getElementById("passwordSuccessView"),
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
  let accountFlow = 0;

  function hidePasswordFields(scope) {
    scope.querySelectorAll(".password-field").forEach((field) => {
      field.querySelector("input").type = "password";
      const button = field.querySelector(".password-toggle");
      button.setAttribute("aria-label", "Mostrar senha");
      button.setAttribute("aria-pressed", "false");
      button.classList.remove("is-visible");
    });
  }

  for (const input of document.querySelectorAll('#authScreen input[type="password"], #accountScreen input[type="password"]')) {
    const label = input.closest("label");
    const field = document.createElement("div");
    field.className = "password-field";
    label.parentNode.insertBefore(field, label);
    field.appendChild(label);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "password-toggle";
    button.setAttribute("aria-label", "Mostrar senha");
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-5.5 10-5.5S22 12 22 12s-3.5 5.5-10 5.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/><path class="password-eye-slash" d="M4 20 20 4"/></svg>';
    field.appendChild(button);
    button.addEventListener("click", () => {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      button.classList.toggle("is-visible", visible);
      button.setAttribute("aria-label", visible ? "Ocultar senha" : "Mostrar senha");
      button.setAttribute("aria-pressed", String(visible));
      input.focus({ preventScroll: true });
      if (start !== null && end !== null) input.setSelectionRange(start, end);
    });
  }

  function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.hidden = !message;
    element.classList.toggle("is-error", isError);
  }

  function showView(name) {
    hidePasswordFields(authScreen);
    currentView = name;
    Object.entries(views).forEach(([key, view]) => { view.hidden = key !== name; });
    showMessage(authMessage, "");
    document.getElementById("closeAuthButton").hidden = name === "signupSuccess" || name === "unconfirmed";
    authScreen.classList.add("is-visible");
    (views[name].querySelector("input") || views[name].querySelector("button"))?.focus();
  }

  function closeAuth() {
    hidePasswordFields(authScreen);
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
    if (name === "email") {
      currentAccountEmail.textContent = accountEmail.textContent;
      document.querySelector('#emailForm input[name="email"]').value = "";
    }
    (accountViews[name].querySelector("input") || accountViews[name].querySelector("button"))?.focus();
  }

  function clearAccountPasswords() {
    accountPasswordForm.reset();
    passwordReauthForm.reset();
    hidePasswordFields(accountScreen);
  }

  function returnToAccount() {
    ++accountFlow;
    clearAccountPasswords();
    showAccountView("overview");
  }

  function closeAccount() {
    accountScreen.classList.remove("is-visible");
    returnToAccount();
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

  function accountAuthError(error, kind) {
    const code = error?.code;
    if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || code?.includes("rate_limit")) {
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    }
    if (kind === "email") {
      if (code === "email_address_invalid" || code === "validation_failed") return "Confira o novo e-mail e tente novamente.";
      if (code === "email_exists" || code === "user_already_exists") return "Não foi possível solicitar a troca para este endereço. Confira o e-mail ou tente outro.";
      if (code === "email_address_not_authorized") return "Não foi possível enviar o e-mail de confirmação. Tente novamente mais tarde.";
    }
    if (kind === "password") {
      if (code === "current_password_invalid" || code === "invalid_credentials") return "Senha atual incorreta.";
      if (code === "current_password_required") return "Informe sua senha atual.";
      if (code === "same_password") return "Escolha uma senha diferente da atual.";
      if (code === "weak_password") return "Use ao menos 8 caracteres, com maiúscula, minúscula e número.";
      if (code === "reauthentication_not_valid" || code === "otp_expired" || code === "otp_disabled") return "Código inválido ou expirado. Confira o e-mail ou solicite outro código.";
    }
    return "Não foi possível concluir a operação. Verifique sua conexão e tente novamente.";
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
      ++accountFlow;
      guestRow.hidden = false;
      userRow.hidden = true;
      nicknameEl.textContent = "";
      accountScreen.classList.remove("is-visible");
      clearAccountPasswords();
      accountNickname.textContent = "—";
      accountEmail.textContent = "—";
      accountBestScore.textContent = "—";
      return false;
    }
    guestRow.hidden = true;
    userRow.hidden = false;
    nicknameEl.textContent = "Conta conectada";
    accountEmail.textContent = session.user.email || "—";
    currentAccountEmail.textContent = accountEmail.textContent;
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
    document.querySelectorAll('#signupForm input[name="password"], #signupForm input[name="confirmPassword"]').forEach((input) => { input.value = ""; });
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
    returnToAccount();
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
    returnToAccount();
    document.getElementById("changeNicknameButton").focus();
  });
  document.getElementById("changeNicknameButton").addEventListener("click", () => showAccountView("nickname"));
  document.getElementById("changeEmailButton").addEventListener("click", () => showAccountView("email"));
  document.getElementById("changePasswordButton").addEventListener("click", () => {
    clearAccountPasswords();
    showAccountView("password");
  });
  document.getElementById("deleteAccountButton").addEventListener("click", () => {
    showMessage(accountMessage, "Função ainda não disponível nesta versão de desenvolvimento.");
  });
  for (const id of ["cancelEmailButton", "emailPendingOkButton", "cancelPasswordButton", "cancelReauthButton", "passwordSuccessOkButton"]) {
    document.getElementById(id).addEventListener("click", returnToAccount);
  }
  accountScreen.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") closeAccount();
  });
  document.getElementById("emailForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const email = String(new FormData(form).get("email")).trim();
    showMessage(accountMessage, "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMessage(accountMessage, "Informe um e-mail válido.", true);
      return;
    }
    button.disabled = true;
    const flow = ++accountFlow;
    try {
      const { data, error: userError } = await client.auth.getUser();
      if (userError || !data.user) throw userError || new Error("Missing user");
      if (email.toLowerCase() === data.user.email?.toLowerCase()) {
        showMessage(accountMessage, "Este já é o e-mail da sua conta.", true);
        return;
      }
      const { error } = await client.auth.updateUser({ email }, { emailRedirectTo: redirectUrl });
      if (error) throw error;
      if (flow !== accountFlow) return;
      document.getElementById("pendingAccountEmail").textContent = email;
      form.reset();
      showAccountView("emailPending");
    } catch (error) {
      if (flow === accountFlow) showMessage(accountMessage, accountAuthError(error, "email"), true);
    } finally {
      button.disabled = false;
    }
  });
  accountPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = accountPasswordForm.querySelector('button[type="submit"]');
    const values = new FormData(accountPasswordForm);
    const currentPassword = String(values.get("currentPassword"));
    const password = String(values.get("password"));
    showMessage(accountMessage, "");
    if (!currentPassword || !password || !values.get("confirmPassword")) {
      showMessage(accountMessage, "Preencha todos os campos de senha.", true);
      return;
    }
    if (!validPassword(password)) {
      showMessage(accountMessage, "Use ao menos 8 caracteres, com maiúscula, minúscula e número.", true);
      return;
    }
    if (password !== values.get("confirmPassword")) {
      showMessage(accountMessage, "As senhas não coincidem.", true);
      return;
    }
    button.disabled = true;
    const flow = ++accountFlow;
    try {
      const { error } = await client.auth.updateUser({ password, current_password: currentPassword });
      if (error?.code === "reauthentication_needed") {
        const { error: reauthError } = await client.auth.reauthenticate();
        if (reauthError) throw reauthError;
        if (flow === accountFlow) showAccountView("passwordReauth");
        return;
      }
      if (error) throw error;
      if (flow !== accountFlow) return;
      clearAccountPasswords();
      showAccountView("passwordSuccess");
    } catch (error) {
      if (flow === accountFlow) showMessage(accountMessage, accountAuthError(error, "password"), true);
    } finally {
      button.disabled = false;
    }
  });
  passwordReauthForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = passwordReauthForm.querySelector('button[type="submit"]');
    const nonce = String(new FormData(passwordReauthForm).get("nonce")).trim();
    showMessage(accountMessage, "");
    if (!nonce) {
      showMessage(accountMessage, "Informe o código recebido por e-mail.", true);
      return;
    }
    button.disabled = true;
    const flow = ++accountFlow;
    try {
      const values = new FormData(accountPasswordForm);
      const { error } = await client.auth.updateUser({
        password: String(values.get("password")),
        current_password: String(values.get("currentPassword")),
        nonce,
      });
      if (error) throw error;
      if (flow !== accountFlow) return;
      clearAccountPasswords();
      showAccountView("passwordSuccess");
    } catch (error) {
      if (flow === accountFlow) showMessage(accountMessage, accountAuthError(error, "password"), true);
    } finally {
      button.disabled = false;
    }
  });
  document.getElementById("resendReauthButton").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const flow = accountFlow;
    try {
      const { error } = await client.auth.reauthenticate();
      if (error) throw error;
      if (flow === accountFlow) showMessage(accountMessage, "Enviamos um novo código para o e-mail da conta.");
    } catch (error) {
      if (flow === accountFlow) showMessage(accountMessage, accountAuthError(error, "password"), true);
    } finally {
      button.disabled = false;
    }
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

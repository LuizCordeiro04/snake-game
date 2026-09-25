(() => {
  const menu = document.getElementById("menuScreen");
  const screen = document.getElementById("rankingScreen");
  const content = document.getElementById("rankingContent");
  const list = document.getElementById("rankingList");
  const status = document.getElementById("rankingStatus");
  const retryButton = document.getElementById("rankingRetryButton");
  const userRow = document.getElementById("accountUser");
  const tabs = {
    general: document.getElementById("generalTab"),
    today: document.getElementById("todayTab"),
  };

  let scope = "general";
  let entries = [];
  let userId = null;
  let requestId = 0;
  let screenId = 0;
  let controller = null;

  function isOpen() {
    return screen.classList.contains("is-visible");
  }

  function renderRows() {
    const fragment = document.createDocumentFragment();

    entries.forEach((entry) => {
      const row = document.createElement("li");
      const position = document.createElement("span");
      const name = document.createElement("span");
      const points = document.createElement("span");
      const isSelf = userId && entry.playerId === userId;

      row.classList.toggle("is-self", Boolean(isSelf));
      row.classList.toggle("is-top-three", entry.position <= 3);
      position.className = "ranking-position";
      position.textContent = String(entry.position);
      name.className = "ranking-name";
      name.textContent = entry.nickname;
      name.title = entry.nickname;
      points.className = "ranking-points";
      points.textContent = String(entry.score);
      row.append(position, name, points);
      fragment.append(row);
    });

    list.replaceChildren(fragment);
  }

  function showStatus(message, retry = false) {
    entries = [];
    list.replaceChildren();
    list.hidden = true;
    status.textContent = message;
    status.hidden = false;
    retryButton.hidden = !retry;
  }

  function normalizeEntries(payload, requestedScope) {
    if (payload?.scope !== requestedScope || !Array.isArray(payload.entries) || payload.entries.length > 50) {
      throw new Error("Invalid leaderboard response");
    }

    const integer = (value) => typeof value === "number" ? value :
      typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value) ? Number(value) : NaN;

    return payload.entries.map((entry) => {
      const position = integer(entry?.position);
      const score = integer(entry?.score);
      const playerName = entry?.nickname;
      if (!Number.isSafeInteger(position) || position < 1 ||
          !Number.isSafeInteger(score) || score < 0 ||
          typeof playerName !== "string" || !playerName.trim() || playerName.length > 20 ||
          typeof entry.player_id !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.player_id)) {
        throw new Error("Invalid leaderboard entry");
      }
      return {
        position,
        nickname: playerName,
        score,
        playerId: entry.player_id,
      };
    });
  }

  async function load(nextScope) {
    scope = nextScope;
    Object.entries(tabs).forEach(([name, tab]) => {
      const selected = name === scope;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    content.setAttribute("aria-labelledby", tabs[scope].id);

    controller?.abort();
    controller = new AbortController();
    const currentRequest = ++requestId;
    showStatus("Carregando ranking...");

    try {
      const config = window.SNAKE_SUPABASE;
      if (!config?.url || !config?.publishableKey) throw new Error("Missing public configuration");
      const url = new URL("/functions/v1/leaderboard", config.url);
      url.searchParams.set("scope", scope);
      const response = await fetch(url, {
        method: "GET",
        headers: { apikey: config.publishableKey },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Leaderboard request failed");
      const result = normalizeEntries(await response.json(), nextScope);
      if (!isOpen() || currentRequest !== requestId) return;

      if (result.length === 0) {
        showStatus("Nenhuma pontuação por enquanto.");
        return;
      }
      entries = result;
      renderRows();
      status.hidden = true;
      retryButton.hidden = true;
      list.hidden = false;
    } catch (error) {
      if (!isOpen() || currentRequest !== requestId || error?.name === "AbortError") return;
      showStatus("Não foi possível carregar o ranking.", true);
    }
  }

  async function syncIdentity(openedScreen) {
    try {
      const { data, error } = await window.SNAKE_AUTH?.getSession() || {};
      if (!isOpen() || openedScreen !== screenId) return;
      userId = error ? null : data?.session?.user?.id || null;
      if (!list.hidden) renderRows();
    } catch {
      if (openedScreen === screenId) userId = null;
    }
  }

  function openRanking() {
    if (!menu.classList.contains("is-visible")) return;
    menu.classList.remove("is-visible");
    screen.classList.add("is-visible");
    userId = null;
    const openedScreen = ++screenId;
    tabs.general.focus();
    load("general");
    syncIdentity(openedScreen);
  }

  function closeRanking() {
    ++screenId;
    ++requestId;
    controller?.abort();
    screen.classList.remove("is-visible");
    menu.classList.add("is-visible");
    document.getElementById("openRankingButton").focus();
  }

  document.getElementById("openRankingButton").addEventListener("click", openRanking);
  window.addEventListener("snake:nickname-updated", () => {
    if (isOpen()) load(scope);
  });
  document.getElementById("closeRankingButton").addEventListener("click", closeRanking);
  retryButton.addEventListener("click", () => load(scope));
  Object.entries(tabs).forEach(([name, tab]) => {
    tab.addEventListener("click", () => {
      if (name !== scope) load(name);
    });
    tab.addEventListener("keydown", (event) => {
      const next = event.key === "ArrowRight" || event.key === "End" ? "today" :
        event.key === "ArrowLeft" || event.key === "Home" ? "general" : null;
      if (!next) return;
      event.preventDefault();
      event.stopPropagation();
      tabs[next].focus();
      if (next !== scope) load(next);
    });
  });
  screen.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeRanking();
    }
  });
  new MutationObserver(() => {
    if (userRow.hidden) userId = null;
    if (isOpen() && !list.hidden) renderRows();
  }).observe(userRow, { attributes: true, attributeFilter: ["hidden"] });
})();

(() => {
  window.addEventListener("snake:gameover", async (event) => {
    const auth = window.SNAKE_AUTH;
    if (!auth) return;

    const score = event.detail.score;
    try {
      const { data, error } = await auth.getSession();
      if (error || !data?.session?.user) return;

      const submission_id = crypto.randomUUID();
      await auth.submitScore({ score, submission_id });
    } catch {
      // Network failures must not interrupt the game.
    }
  });
})();

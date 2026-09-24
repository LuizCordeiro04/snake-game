(() => {
  const status = document.getElementById("onlineScoreStatus");
  let submissionSequence = 0;

  function showStatus(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  window.addEventListener("snake:gameover", async (event) => {
    const currentSubmission = ++submissionSequence;
    showStatus("");

    const auth = window.SNAKE_AUTH;
    if (!auth) return;

    try {
      const { data, error } = await auth.getSession();
      if (currentSubmission !== submissionSequence) return;
      if (error) throw error;
      if (!data?.session?.user) return;

      showStatus("SALVANDO PONTUAÇÃO...");
      const submission_id = crypto.randomUUID();
      const result = await auth.submitScore({ score: event.detail.score, submission_id });
      if (result.error) throw result.error;
      if (currentSubmission === submissionSequence) showStatus("PONTUAÇÃO SALVA");
    } catch {
      if (currentSubmission === submissionSequence) showStatus("PONTUAÇÃO NÃO SALVA");
    }
  });
})();

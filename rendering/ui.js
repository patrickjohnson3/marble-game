export function createUi({ hint, debug, settingsOverlay, debugLines, state }) {
  function setHint(message) {
    hint.textContent = message;
  }

  function isSettingsOpen() {
    return settingsOverlay.classList.contains("open");
  }

  function updateDebugPanel() {
    if (!isSettingsOpen()) return;

    debug.textContent = debugLines(state).join("\n");
  }

  function openSettingsModal() {
    settingsOverlay.classList.add("open");
    settingsOverlay.setAttribute("aria-hidden", "false");
    updateDebugPanel();
  }

  function closeSettingsModal() {
    settingsOverlay.classList.remove("open");
    settingsOverlay.setAttribute("aria-hidden", "true");
  }

  return {
    closeSettingsModal,
    isSettingsOpen,
    openSettingsModal,
    setHint,
    updateDebugPanel
  };
}

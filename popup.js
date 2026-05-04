const LOCK_PRESETS = [25, 50, 90];
const DONATE_URL = "https://paypal.me/TiniFlegar";

const focusToggle = document.getElementById("focus-toggle");
const focusStatus = document.getElementById("focus-status");
const lockIndicator = document.getElementById("lock-indicator");
const timerGrid = document.getElementById("timer-grid");
const customWrap = document.getElementById("custom-wrap");
const customDuration = document.getElementById("custom-duration");
const lockButton = document.getElementById("lock-button");
const themeToggle = document.getElementById("theme-toggle");
const themeToggleLabel = document.getElementById("theme-toggle-label");
const donateButton = document.getElementById("donate-button");

let state = FocusModeStorage.DEFAULT_STATE;
let theme = FocusModeStorage.DEFAULT_THEME;
let selectedDuration = String(LOCK_PRESETS[0]);
let countdownTimer = 0;

initialize();

async function initialize() {
  const [nextState, nextTheme] = await Promise.all([
    FocusModeStorage.getState(),
    FocusModeStorage.getTheme()
  ]);

  state = nextState;
  theme = nextTheme;
  render();
  startCountdown();

  focusToggle.addEventListener("click", handleFocusToggle);
  timerGrid.addEventListener("click", handleTimerSelect);
  lockButton.addEventListener("click", handleLockStart);
  customDuration.addEventListener("change", handleCustomDurationCommit);
  themeToggle.addEventListener("click", handleThemeToggle);
  donateButton.addEventListener("click", handleDonate);
  window.addEventListener("unload", () => {
    window.clearInterval(countdownTimer);
  });

  FocusModeStorage.observeState((nextStateUpdate) => {
    state = nextStateUpdate;
    render();
  });

  FocusModeStorage.observeTheme((nextThemeUpdate) => {
    theme = nextThemeUpdate;
    render();
  });
}

async function handleFocusToggle() {
  state = await FocusModeStorage.getState();

  if (FocusModeStorage.isLocked(state) && state.focusEnabled) {
    render();
    return;
  }

  state = await FocusModeStorage.updateState({
    focusEnabled: !state.focusEnabled
  });

  render();
}

function handleTimerSelect(event) {
  const chip = event.target.closest(".timer-chip");
  if (!chip) {
    return;
  }

  selectedDuration = chip.dataset.duration;
  if (selectedDuration !== "custom") {
    customDuration.value = selectedDuration;
  }

  renderTimerSelection();
}

async function handleLockStart() {
  const durationMinutes = getSelectedDuration();
  if (selectedDuration === "custom") {
    customDuration.value = String(durationMinutes);
  }

  const lockEndTime = Date.now() + (durationMinutes * 60_000);

  state = await FocusModeStorage.setState({
    focusEnabled: true,
    lockEnabled: true,
    lockEndTime
  });

  render();
}

function handleCustomDurationCommit() {
  customDuration.value = String(getSelectedDuration());
  render();
}

async function handleThemeToggle() {
  theme = await FocusModeStorage.setTheme(theme === "light" ? "dark" : "light");
  render();
}

function handleDonate() {
  chrome.tabs.create({ url: DONATE_URL });
}

function render() {
  const locked = FocusModeStorage.isLocked(state);
  const enabled = state.focusEnabled;
  const remainingMs = FocusModeStorage.getRemainingMs(state);

  document.body.dataset.theme = theme;
  document.body.dataset.enabled = String(enabled);
  document.body.dataset.locked = String(locked);

  focusToggle.setAttribute("aria-checked", String(enabled));
  focusToggle.disabled = locked && enabled;

  themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  themeToggleLabel.textContent = theme === "light" ? "Dark" : "Light";

  if (locked && enabled) {
    focusStatus.textContent = "Soft lock active";
    lockIndicator.hidden = false;
    lockIndicator.textContent = `Soft lock: ${formatRemaining(remainingMs)} remaining`;
    lockButton.textContent = "Soft lock active";
    lockButton.disabled = true;
  } else {
    focusStatus.textContent = enabled ? "Distractions hidden" : "YouTube restored";
    lockIndicator.hidden = true;
    lockButton.textContent = `Start ${formatDuration(getSelectedDuration())} soft lock`;
    lockButton.disabled = false;
  }

  renderTimerSelection();
}

function renderTimerSelection() {
  for (const chip of timerGrid.querySelectorAll(".timer-chip")) {
    const active = chip.dataset.duration === selectedDuration;
    chip.classList.toggle("is-selected", active);
    chip.setAttribute("aria-checked", String(active));
  }

  customWrap.hidden = selectedDuration !== "custom";
}

function getSelectedDuration() {
  if (selectedDuration === "custom") {
    const value = Number.parseInt(customDuration.value, 10);
    return Number.isFinite(value)
      ? Math.min(Math.max(value, 1), 480)
      : LOCK_PRESETS[0];
  }

  return Number.parseInt(selectedDuration, 10) || LOCK_PRESETS[0];
}

function formatDuration(durationMinutes) {
  if (durationMinutes < 60) {
    return `${durationMinutes}m`;
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatRemaining(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const totalMinutes = Math.ceil(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) {
    return `${totalMinutes} min`;
  }

  if (!minutes) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function startCountdown() {
  window.clearInterval(countdownTimer);
  countdownTimer = window.setInterval(async () => {
    if (!state.lockEnabled) {
      return;
    }

    const remainingMs = FocusModeStorage.getRemainingMs(state);
    if (remainingMs > 0) {
      lockIndicator.textContent = `Soft lock: ${formatRemaining(remainingMs)} remaining`;
      return;
    }

    state = await FocusModeStorage.updateState({
      lockEnabled: false,
      lockEndTime: null
    });

    render();
  }, 1000);
}

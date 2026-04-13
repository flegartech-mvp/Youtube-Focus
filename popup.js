const LOCK_PRESETS = [25, 50, 90];

const focusToggle = document.getElementById("focus-toggle");
const focusStatus = document.getElementById("focus-status");
const lockIndicator = document.getElementById("lock-indicator");
const timerGrid = document.getElementById("timer-grid");
const customWrap = document.getElementById("custom-wrap");
const customDuration = document.getElementById("custom-duration");
const lockButton = document.getElementById("lock-button");

let state = FocusModeStorage.DEFAULT_STATE;
let selectedDuration = 25;
let countdownTimer = null;

initialize();

async function initialize() {
  state = await FocusModeStorage.getState();
  render();
  startCountdown();

  focusToggle.addEventListener("click", handleFocusToggle);
  timerGrid.addEventListener("click", handleTimerSelect);
  lockButton.addEventListener("click", handleLockStart);

  FocusModeStorage.observe((nextState) => {
    state = nextState;
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
  syncTabs(state);
}

function handleTimerSelect(event) {
  const chip = event.target.closest(".timer-chip");
  if (!chip) {
    return;
  }

  const duration = chip.dataset.duration;
  selectedDuration = duration === "custom"
    ? "custom"
    : Number.parseInt(duration, 10);

  renderTimerSelection();
}

async function handleLockStart() {
  const durationMinutes = getSelectedDuration();
  const lockEndTime = Date.now() + (durationMinutes * 60_000);

  state = await FocusModeStorage.setState({
    focusEnabled: true,
    lockEnabled: true,
    lockEndTime
  });

  render();
  syncTabs(state);
}

function render() {
  const locked = FocusModeStorage.isLocked(state);
  const enabled = state.focusEnabled;
  const remainingMs = FocusModeStorage.getRemainingMs(state);

  document.body.dataset.enabled = String(enabled);
  document.body.dataset.locked = String(locked);
  focusToggle.setAttribute("aria-checked", String(enabled));
  focusToggle.disabled = locked && enabled;

  if (locked && enabled) {
    focusStatus.textContent = "Focus locked";
    lockIndicator.hidden = false;
    lockIndicator.textContent = `Locked: ${formatRemaining(remainingMs)} remaining`;
    lockButton.textContent = "Focus locked";
    lockButton.disabled = true;
  } else {
    focusStatus.textContent = enabled ? "Distractions hidden" : "YouTube restored";
    lockIndicator.hidden = true;
    lockButton.textContent = "Start lock";
    lockButton.disabled = false;
  }

  renderTimerSelection();
}

function renderTimerSelection() {
  const selected = String(selectedDuration);

  for (const chip of timerGrid.querySelectorAll(".timer-chip")) {
    const active = chip.dataset.duration === selected;
    chip.classList.toggle("is-selected", active);
    chip.setAttribute("aria-checked", String(active));
  }

  customWrap.hidden = selectedDuration !== "custom";
}

function getSelectedDuration() {
  if (selectedDuration === "custom") {
    const value = Number.parseInt(customDuration.value, 10);
    return Number.isFinite(value) ? Math.min(Math.max(value, 1), 480) : LOCK_PRESETS[0];
  }

  return selectedDuration;
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
  clearInterval(countdownTimer);
  countdownTimer = setInterval(async () => {
    if (!state.lockEnabled) {
      render();
      return;
    }

    const remainingMs = FocusModeStorage.getRemainingMs(state);
    if (remainingMs > 0) {
      lockIndicator.textContent = `Locked: ${formatRemaining(remainingMs)} remaining`;
      return;
    }

    state = await FocusModeStorage.updateState({
      lockEnabled: false,
      lockEndTime: null
    });

    render();
    syncTabs(state);
  }, 1000);
}

function syncTabs(nextState) {
  chrome.tabs.query({ url: ["https://www.youtube.com/*"] }, (tabs) => {
    if (!Array.isArray(tabs)) {
      return;
    }

    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        type: "focus-state-updated",
        state: nextState
      }, () => {
        void chrome.runtime.lastError;
      });
    }
  });
}

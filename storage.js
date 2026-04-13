(() => {
  const STATE_KEY = "focusModeState";
  const THEME_KEY = "focusModeTheme";
  const DEFAULT_STATE = {
    focusEnabled: true,
    lockEnabled: false,
    lockEndTime: null
  };
  const DEFAULT_THEME = "light";

  function cloneState(state) {
    return {
      focusEnabled: state.focusEnabled,
      lockEnabled: state.lockEnabled,
      lockEndTime: state.lockEndTime
    };
  }

  function normalizeState(input, now = Date.now()) {
    const source = input && typeof input === "object" ? input : {};
    const focusEnabled = typeof source.focusEnabled === "boolean"
      ? source.focusEnabled
      : DEFAULT_STATE.focusEnabled;
    const lockEnabled = typeof source.lockEnabled === "boolean"
      ? source.lockEnabled
      : DEFAULT_STATE.lockEnabled;
    const lockEndTime = Number.isFinite(source.lockEndTime) ? source.lockEndTime : null;

    if (!lockEnabled || !lockEndTime || lockEndTime <= now) {
      return {
        focusEnabled: Boolean(focusEnabled),
        lockEnabled: false,
        lockEndTime: null
      };
    }

    return {
      focusEnabled: true,
      lockEnabled: true,
      lockEndTime
    };
  }

  function normalizeTheme(theme) {
    return theme === "dark" ? "dark" : DEFAULT_THEME;
  }

  function isLocked(state, now = Date.now()) {
    const normalized = normalizeState(state, now);
    return normalized.lockEnabled && normalized.lockEndTime !== null && normalized.lockEndTime > now;
  }

  function getRemainingMs(state, now = Date.now()) {
    const normalized = normalizeState(state, now);
    if (!normalized.lockEnabled || !normalized.lockEndTime) {
      return 0;
    }

    return Math.max(0, normalized.lockEndTime - now);
  }

  function statesEqual(left, right) {
    return left.focusEnabled === right.focusEnabled
      && left.lockEnabled === right.lockEnabled
      && left.lockEndTime === right.lockEndTime;
  }

  function hasCanonicalShape(state) {
    if (!state || typeof state !== "object") {
      return false;
    }

    const keys = Object.keys(state).sort();
    return keys.length === 3
      && keys[0] === "focusEnabled"
      && keys[1] === "lockEnabled"
      && keys[2] === "lockEndTime";
  }

  function readRawState() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ [STATE_KEY]: DEFAULT_STATE }, (result) => {
        resolve(result[STATE_KEY]);
      });
    });
  }

  function writeRawState(state) {
    const normalized = normalizeState(state);
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STATE_KEY]: normalized }, () => {
        resolve(cloneState(normalized));
      });
    });
  }

  function readRawTheme() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ [THEME_KEY]: DEFAULT_THEME }, (result) => {
        resolve(result[THEME_KEY]);
      });
    });
  }

  function writeRawTheme(theme) {
    const normalized = normalizeTheme(theme);
    return new Promise((resolve) => {
      chrome.storage.local.set({ [THEME_KEY]: normalized }, () => {
        resolve(normalized);
      });
    });
  }

  async function getState() {
    const rawState = await readRawState();
    const normalized = normalizeState(rawState);

    if (!hasCanonicalShape(rawState) || !statesEqual(normalized, rawState)) {
      return writeRawState(normalized);
    }

    return cloneState(normalized);
  }

  async function setState(nextState) {
    return writeRawState(nextState);
  }

  async function updateState(patch) {
    const currentState = await getState();
    const partial = typeof patch === "function" ? patch(cloneState(currentState)) : patch;
    const nextState = normalizeState({ ...currentState, ...(partial || {}) });

    if (statesEqual(currentState, nextState)) {
      return cloneState(currentState);
    }

    return writeRawState(nextState);
  }

  async function getTheme() {
    const rawTheme = await readRawTheme();
    const normalized = normalizeTheme(rawTheme);

    if (normalized !== rawTheme) {
      return writeRawTheme(normalized);
    }

    return normalized;
  }

  async function setTheme(theme) {
    return writeRawTheme(theme);
  }

  function observe(listener) {
    const wrapped = (changes, areaName) => {
      if (areaName !== "local" || !changes[STATE_KEY]) {
        return;
      }

      listener(normalizeState(changes[STATE_KEY].newValue));
    };

    chrome.storage.onChanged.addListener(wrapped);
    return () => chrome.storage.onChanged.removeListener(wrapped);
  }

  function observeTheme(listener) {
    const wrapped = (changes, areaName) => {
      if (areaName !== "local" || !changes[THEME_KEY]) {
        return;
      }

      listener(normalizeTheme(changes[THEME_KEY].newValue));
    };

    chrome.storage.onChanged.addListener(wrapped);
    return () => chrome.storage.onChanged.removeListener(wrapped);
  }

  self.FocusModeStorage = {
    STATE_KEY,
    THEME_KEY,
    DEFAULT_STATE: cloneState(DEFAULT_STATE),
    DEFAULT_THEME,
    normalizeState,
    normalizeTheme,
    isLocked,
    getRemainingMs,
    getState,
    setState,
    updateState,
    getTheme,
    setTheme,
    observe,
    observeTheme
  };
})();

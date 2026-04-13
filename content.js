(() => {
  const STYLE_ID = "yt-focus-mode-style";
  const PLACEHOLDER_ID = "yt-focus-mode-placeholder";
  const BLOCKED_ROUTES = ["/", "/feed/explore", "/feed/trending", "/shorts"];

  let state = FocusModeStorage.DEFAULT_STATE;
  let lastUrl = location.href;
  let applyTimer = null;

  initialize();

  async function initialize() {
    injectStyles();
    bindNavigation();
    bindMessages();
    bindStorage();
    observeDom();

    state = await FocusModeStorage.getState();
    queueApply();
  }

  function bindNavigation() {
    const schedule = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
      }

      queueApply();
    };

    const events = [
      "yt-navigate-start",
      "yt-navigate-finish",
      "yt-page-data-updated",
      "spfdone",
      "popstate"
    ];

    for (const eventName of events) {
      window.addEventListener(eventName, schedule, true);
    }

    wrapHistoryMethod("pushState");
    wrapHistoryMethod("replaceState");
    window.addEventListener("yt-focus-history", schedule, true);
  }

  function wrapHistoryMethod(methodName) {
    const original = history[methodName];
    if (typeof original !== "function" || original.__ytFocusWrapped) {
      return;
    }

    const wrapped = function (...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event("yt-focus-history"));
      return result;
    };

    wrapped.__ytFocusWrapped = true;
    history[methodName] = wrapped;
  }

  function bindMessages() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || message.type !== "focus-state-updated") {
        return;
      }

      state = FocusModeStorage.normalizeState(message.state);
      queueApply();
      sendResponse({ ok: true });
    });
  }

  function bindStorage() {
    FocusModeStorage.observe((nextState) => {
      state = nextState;
      queueApply();
    });
  }

  function observeDom() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList" && (mutation.addedNodes.length || mutation.removedNodes.length)) {
          queueApply();
          return;
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function queueApply() {
    if (applyTimer !== null) {
      return;
    }

    applyTimer = window.setTimeout(() => {
      applyTimer = null;
      applyState();
    }, 50);
  }

  function applyState() {
    state = FocusModeStorage.normalizeState(state);

    const route = getRouteState();
    const focusOn = state.focusEnabled;
    const root = document.documentElement;

    root.classList.toggle("yt-focus-on", focusOn);
    root.classList.toggle("yt-focus-blocked", focusOn && route.blocked);
    root.classList.toggle("yt-focus-watch", focusOn && route.watchPage);

    const placeholder = ensurePlaceholder();
    placeholder.hidden = !(focusOn && route.blocked);

    syncNotificationPanels(focusOn);
  }

  function getRouteState() {
    const path = location.pathname;
    const blocked = BLOCKED_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));

    return {
      blocked,
      watchPage: path === "/watch"
    };
  }

  function ensurePlaceholder() {
    let placeholder = document.getElementById(PLACEHOLDER_ID);

    if (!placeholder) {
      placeholder = document.createElement("div");
      placeholder.id = PLACEHOLDER_ID;
      placeholder.hidden = true;
      placeholder.innerHTML = '<div class="yt-focus-card">Stay focused.</div>';
      (document.body || document.documentElement).appendChild(placeholder);
    }

    return placeholder;
  }

  function syncNotificationPanels(focusOn) {
    const hiddenPanels = document.querySelectorAll("[data-focus-hidden-notifications='true']");
    for (const panel of hiddenPanels) {
      if (!focusOn) {
        panel.hidden = false;
        panel.removeAttribute("data-focus-hidden-notifications");
      }
    }

    if (!focusOn) {
      return;
    }

    const panels = document.querySelectorAll("tp-yt-iron-dropdown, ytd-multi-page-menu-renderer");
    for (const panel of panels) {
      if (!panel.querySelector("ytd-notification-renderer")) {
        continue;
      }

      if (panel.hidden) {
        continue;
      }

      panel.hidden = true;
      panel.setAttribute("data-focus-hidden-notifications", "true");
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html.yt-focus-on #guide-button,
      html.yt-focus-on ytd-mini-guide-renderer,
      html.yt-focus-on ytd-guide-renderer,
      html.yt-focus-on tp-yt-app-drawer,
      html.yt-focus-on #end,
      html.yt-focus-on #voice-search-button,
      html.yt-focus-on ytd-notification-topbar-button-renderer,
      html.yt-focus-on ytd-rich-grid-renderer,
      html.yt-focus-on ytd-rich-shelf-renderer,
      html.yt-focus-on ytd-reel-shelf-renderer,
      html.yt-focus-on ytd-rich-item-renderer:has(a[href*="/shorts/"]),
      html.yt-focus-on ytd-rich-section-renderer:has(a[href*="/shorts/"]),
      html.yt-focus-on ytd-video-renderer:has(a[href*="/shorts/"]),
      html.yt-focus-on ytd-grid-video-renderer:has(a[href*="/shorts/"]),
      html.yt-focus-on ytd-compact-video-renderer,
      html.yt-focus-on ytd-compact-radio-renderer,
      html.yt-focus-on ytd-compact-playlist-renderer,
      html.yt-focus-on ytd-watch-next-secondary-results-renderer,
      html.yt-focus-on ytd-comments,
      html.yt-focus-on #comments,
      html.yt-focus-on #related,
      html.yt-focus-on #secondary,
      html.yt-focus-on ytd-merch-shelf-renderer,
      html.yt-focus-on ytd-rich-grid-renderer #contents,
      html.yt-focus-on tp-yt-iron-dropdown:has(ytd-notification-renderer),
      html.yt-focus-on ytd-multi-page-menu-renderer:has(ytd-notification-renderer),
      html.yt-focus-on ytd-guide-entry-renderer:has(a[href="/feed/explore"]),
      html.yt-focus-on ytd-guide-entry-renderer:has(a[href="/feed/trending"]),
      html.yt-focus-on ytd-guide-entry-renderer:has(a[href^="/shorts"]),
      html.yt-focus-on ytd-mini-guide-entry-renderer:has(a[href="/feed/explore"]),
      html.yt-focus-on ytd-mini-guide-entry-renderer:has(a[href="/feed/trending"]),
      html.yt-focus-on ytd-mini-guide-entry-renderer:has(a[href^="/shorts"]) {
        display: none !important;
      }

      html.yt-focus-on ytd-watch-flexy[is-two-columns_] #columns {
        display: block !important;
      }

      html.yt-focus-on ytd-watch-flexy[is-two-columns_] #primary {
        width: min(1120px, calc(100vw - 48px)) !important;
        max-width: 1120px !important;
        margin: 0 auto !important;
      }

      html.yt-focus-on.yt-focus-blocked ytd-page-manager,
      html.yt-focus-on.yt-focus-blocked #secondary,
      html.yt-focus-on.yt-focus-blocked #primary {
        display: none !important;
      }

      #${PLACEHOLDER_ID} {
        position: fixed;
        inset: 96px 24px 24px;
        z-index: 2147483646;
        display: none;
        place-items: center;
        pointer-events: none;
      }

      html.yt-focus-on.yt-focus-blocked #${PLACEHOLDER_ID} {
        display: grid;
      }

      .yt-focus-card {
        min-width: min(100%, 380px);
        padding: 28px 32px;
        border-radius: 28px;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(17, 17, 17, 0.08);
        box-shadow: 0 24px 60px rgba(17, 17, 17, 0.14);
        color: #111111;
        font: 600 28px/1.1 "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif;
        letter-spacing: -0.04em;
        text-align: center;
        backdrop-filter: blur(18px);
        animation: yt-focus-fade 180ms ease;
      }

      html[dark] .yt-focus-card {
        background: rgba(24, 24, 24, 0.92);
        border-color: rgba(255, 255, 255, 0.08);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.36);
        color: #f5f5f5;
      }

      @keyframes yt-focus-fade {
        from {
          opacity: 0;
          transform: translateY(8px);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }
})();

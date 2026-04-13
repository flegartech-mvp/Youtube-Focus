(() => {
  const STORAGE_KEY = "focusModeEnabled";
  const STYLE_ID = "yt-focus-mode-style";
  const PLACEHOLDER_ID = "yt-focus-mode-placeholder";
  const ROUTE_CLASSES = [
    "yt-focus-mode-blocked",
    "yt-focus-route-home",
    "yt-focus-route-explore",
    "yt-focus-route-trending",
    "yt-focus-route-shorts"
  ];

  let isEnabled = true;
  let applyQueued = false;

  injectStyles();
  bindStorage();
  bindNavigation();
  observeDom();
  queueApply();

  function bindStorage() {
    chrome.storage.local.get({ [STORAGE_KEY]: true }, (result) => {
      isEnabled = Boolean(result[STORAGE_KEY]);
      applyFocusMode();
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes[STORAGE_KEY]) {
        return;
      }

      isEnabled = Boolean(changes[STORAGE_KEY].newValue);
      applyFocusMode();
    });
  }

  function bindNavigation() {
    const events = ["yt-navigate-finish", "yt-page-data-updated", "spfdone", "popstate"];

    for (const eventName of events) {
      window.addEventListener(eventName, queueApply, true);
    }
  }

  function observeDom() {
    const observer = new MutationObserver(() => {
      queueApply();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function queueApply() {
    if (applyQueued) {
      return;
    }

    applyQueued = true;
    requestAnimationFrame(() => {
      applyQueued = false;
      applyFocusMode();
    });
  }

  function applyFocusMode() {
    const route = getRouteState();
    const root = document.documentElement;

    root.classList.toggle("yt-focus-mode-on", isEnabled);

    for (const className of ROUTE_CLASSES) {
      root.classList.remove(className);
    }

    if (isEnabled && route.blocked) {
      root.classList.add("yt-focus-mode-blocked", `yt-focus-route-${route.name}`);
    }

    const placeholder = ensurePlaceholder();
    placeholder.hidden = !(isEnabled && route.blocked);

    syncNotificationPanels();
  }

  function getRouteState() {
    const url = new URL(window.location.href);

    if (url.pathname === "/") {
      return { name: "home", blocked: true };
    }

    if (url.pathname.startsWith("/feed/explore")) {
      return { name: "explore", blocked: true };
    }

    if (url.pathname.startsWith("/feed/trending")) {
      return { name: "trending", blocked: true };
    }

    if (url.pathname.startsWith("/shorts")) {
      return { name: "shorts", blocked: true };
    }

    return { name: "", blocked: false };
  }

  function ensurePlaceholder() {
    let placeholder = document.getElementById(PLACEHOLDER_ID);

    if (!placeholder) {
      placeholder = document.createElement("div");
      placeholder.id = PLACEHOLDER_ID;
      placeholder.hidden = true;
      placeholder.innerHTML = '<div class="yt-focus-mode-card">Stay focused.</div>';
      (document.body || document.documentElement).appendChild(placeholder);
    }

    return placeholder;
  }

  function syncNotificationPanels() {
    const hiddenPanels = document.querySelectorAll("[data-yt-focus-notifications='true']");

    for (const panel of hiddenPanels) {
      if (!isEnabled) {
        panel.hidden = false;
        panel.removeAttribute("data-yt-focus-notifications");
      }
    }

    if (!isEnabled) {
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
      panel.setAttribute("data-yt-focus-notifications", "true");
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html.yt-focus-mode-on ytd-guide-entry-renderer:has(a[href="/feed/explore"]),
      html.yt-focus-mode-on ytd-guide-entry-renderer:has(a[href="/feed/trending"]),
      html.yt-focus-mode-on ytd-guide-entry-renderer:has(a[href^="/shorts"]),
      html.yt-focus-mode-on ytd-mini-guide-entry-renderer:has(a[href="/feed/explore"]),
      html.yt-focus-mode-on ytd-mini-guide-entry-renderer:has(a[href="/feed/trending"]),
      html.yt-focus-mode-on ytd-mini-guide-entry-renderer:has(a[href^="/shorts"]),
      html.yt-focus-mode-on ytd-watch-flexy #secondary,
      html.yt-focus-mode-on ytd-watch-flexy #comments,
      html.yt-focus-mode-on ytd-watch-flexy ytd-comments,
      html.yt-focus-mode-on ytd-watch-flexy ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"],
      html.yt-focus-mode-on ytd-reel-shelf-renderer,
      html.yt-focus-mode-on ytd-rich-shelf-renderer[is-shorts],
      html.yt-focus-mode-on ytd-rich-section-renderer:has(a[href*="/shorts/"]),
      html.yt-focus-mode-on ytd-rich-item-renderer:has(a[href*="/shorts/"]),
      html.yt-focus-mode-on ytd-video-renderer:has(a[href*="/shorts/"]),
      html.yt-focus-mode-on ytd-grid-video-renderer:has(a[href*="/shorts/"]),
      html.yt-focus-mode-on ytd-compact-video-renderer:has(a[href*="/shorts/"]),
      html.yt-focus-mode-on ytd-compact-radio-renderer:has(a[href*="/shorts/"]),
      html.yt-focus-mode-on tp-yt-iron-dropdown:has(ytd-notification-renderer),
      html.yt-focus-mode-on ytd-multi-page-menu-renderer:has(ytd-notification-renderer) {
        display: none !important;
      }

      html.yt-focus-mode-on ytd-watch-flexy[is-two-columns_] #columns {
        display: block !important;
      }

      html.yt-focus-mode-on ytd-watch-flexy[is-two-columns_] #primary {
        width: min(1180px, calc(100vw - 48px)) !important;
        max-width: 1180px !important;
        margin: 0 auto !important;
      }

      html.yt-focus-mode-on.yt-focus-mode-blocked tp-yt-app-drawer,
      html.yt-focus-mode-on.yt-focus-mode-blocked ytd-mini-guide-renderer,
      html.yt-focus-mode-on.yt-focus-mode-blocked ytd-guide-renderer,
      html.yt-focus-mode-on.yt-focus-mode-blocked ytd-page-manager {
        display: none !important;
      }

      #${PLACEHOLDER_ID} {
        position: fixed;
        inset: 88px 24px 24px;
        z-index: 2147483646;
        display: none;
        place-items: center;
        pointer-events: none;
      }

      html.yt-focus-mode-on.yt-focus-mode-blocked #${PLACEHOLDER_ID} {
        display: grid;
      }

      .yt-focus-mode-card {
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
        animation: yt-focus-mode-fade 180ms ease;
      }

      html[dark] .yt-focus-mode-card {
        background: rgba(24, 24, 24, 0.92);
        border-color: rgba(255, 255, 255, 0.08);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.36);
        color: #f5f5f5;
      }

      @keyframes yt-focus-mode-fade {
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

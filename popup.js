const STORAGE_KEY = "focusModeEnabled";

const focusToggle = document.getElementById("focus-toggle");
const statusText = document.getElementById("status");

let isEnabled = true;

initialize();

async function initialize() {
  isEnabled = await readState();
  render();

  focusToggle.addEventListener("click", async () => {
    isEnabled = !isEnabled;
    render();
    await writeState(isEnabled);
  });
}

function render() {
  document.body.dataset.enabled = String(isEnabled);
  focusToggle.setAttribute("aria-checked", String(isEnabled));
  statusText.textContent = isEnabled ? "Distractions hidden" : "YouTube restored";
}

function readState() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: true }, (result) => {
      resolve(Boolean(result[STORAGE_KEY]));
    });
  });
}

function writeState(value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: value }, resolve);
  });
}

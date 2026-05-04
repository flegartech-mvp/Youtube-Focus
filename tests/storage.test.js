const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createChromeMock(initialStore = {}) {
  const store = { ...initialStore };
  const listeners = new Set();

  return {
    store,
    chrome: {
      storage: {
        local: {
          get(defaults, callback) {
            const result = { ...defaults };
            for (const key of Object.keys(defaults)) {
              if (Object.prototype.hasOwnProperty.call(store, key)) {
                result[key] = store[key];
              }
            }
            callback(result);
          },
          set(payload, callback) {
            const changes = {};
            for (const [key, value] of Object.entries(payload)) {
              changes[key] = {
                oldValue: store[key],
                newValue: value
              };
              store[key] = value;
            }
            for (const listener of listeners) {
              listener(changes, "local");
            }
            callback?.();
          }
        },
        onChanged: {
          addListener(listener) {
            listeners.add(listener);
          },
          removeListener(listener) {
            listeners.delete(listener);
          }
        }
      }
    }
  };
}

function loadStorage(initialStore) {
  const { chrome, store } = createChromeMock(initialStore);
  const context = vm.createContext({
    chrome,
    self: {}
  });
  const source = fs.readFileSync(path.join(__dirname, "..", "storage.js"), "utf8");

  vm.runInContext(source, context, { filename: "storage.js" });

  return {
    storage: context.self.FocusModeStorage,
    store
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

(async () => {
  {
    const { storage } = loadStorage();
    assert.deepEqual(plain(storage.DEFAULT_STATE), {
      focusEnabled: false,
      lockEnabled: false,
      lockEndTime: null
    });
  }

  {
    const { storage } = loadStorage();
    assert.deepEqual(plain(storage.normalizeState({ lockEnabled: true, lockEndTime: 900 }, 1000)), {
      focusEnabled: false,
      lockEnabled: false,
      lockEndTime: null
    });
  }

  {
    const { storage } = loadStorage();
    assert.deepEqual(plain(storage.normalizeState({ focusEnabled: false, lockEnabled: true, lockEndTime: 2000 }, 1000)), {
      focusEnabled: true,
      lockEnabled: true,
      lockEndTime: 2000
    });
  }

  {
    const { storage, store } = loadStorage({
      focusModeState: {
        focusEnabled: "yes",
        lockEnabled: true,
        lockEndTime: "soon",
        extra: true
      }
    });

    const state = await storage.getState();
    assert.deepEqual(plain(state), {
      focusEnabled: false,
      lockEnabled: false,
      lockEndTime: null
    });
    assert.deepEqual(plain(store.focusModeState), plain(state));
  }

  {
    const { storage } = loadStorage();
    const state = await storage.setState({
      focusEnabled: false,
      lockEnabled: true,
      lockEndTime: Date.now() + 60_000
    });

    assert.equal(state.focusEnabled, true);
    assert.equal(storage.isLocked(state), true);
    assert.ok(storage.getRemainingMs(state) > 0);
  }

  {
    const { storage } = loadStorage();
    let observedState = null;
    const unsubscribe = storage.observeState((state) => {
      observedState = state;
    });

    await storage.setState({
      focusEnabled: true,
      lockEnabled: false,
      lockEndTime: null
    });
    unsubscribe();

    assert.deepEqual(plain(observedState), {
      focusEnabled: true,
      lockEnabled: false,
      lockEndTime: null
    });
  }

  console.log("storage tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/** @typedef {'unavailable' | 'idle' | 'checking' | 'ready' | 'current' | 'failed' | 'blocked'} UpdateState */
/** @typedef {{autoDownload: boolean, autoInstallOnAppQuit: boolean, allowPrerelease: boolean, setFeedURL: (options: {provider: 'generic', url: string}) => void, checkForUpdates: () => Promise<{downloadPromise?: Promise<unknown> | null} | null | void>, quitAndInstall: () => void, on: (event: 'update-downloaded' | 'update-not-available' | 'error', listener: () => void) => unknown}} Updater */
/** No install on quit or arrival. Each restart requires explicit intent and a
 * fresh safety check, including native-menu actions.
 * @param {Updater} updater @param {string | null} feed @param {boolean} packaged
 * @param {(state: UpdateState) => Promise<boolean>} notify
 * @param {(state: UpdateState) => void} publish
 * @param {() => Promise<boolean>} canRestart */
export function setupUpdates(
  updater,
  feed,
  packaged,
  notify,
  publish = () => {
    /* Optional observer. */
  },
  canRestart = async () => false,
) {
  const enabled = packaged && feed !== null;
  /** @type {UpdateState} */
  let state = enabled ? "idle" : "unavailable";
  let isChecking = false;
  let isRestarting = false;
  let isManual = false;
  let hasReportedError = false;
  /** @param {UpdateState} next */
  function setState(next) {
    state = next;
    publish(next);
  }
  async function restart() {
    if (!enabled || state !== "ready" || isRestarting) return;
    isRestarting = true;
    try {
      if (!(await canRestart())) {
        publish("blocked");
        return;
      }
      updater.quitAndInstall();
    } catch {
      setState("failed");
    } finally {
      isRestarting = false;
    }
  }
  /** @param {UpdateState} next */
  async function report(next) {
    try {
      if (await notify(next)) await restart();
    } catch {
      setState("failed");
    }
  }
  if (enabled) {
    Object.assign(updater, {
      autoDownload: true,
      autoInstallOnAppQuit: false,
      allowPrerelease: false,
    });
    updater.setFeedURL({ provider: "generic", url: feed });
    updater.on("update-downloaded", () => setState("ready"));
    updater.on("update-not-available", () => {
      if (state !== "ready") setState("current");
      if (isManual) void report(state);
    });
    updater.on("error", () => {
      if (state !== "ready") setState("failed");
      if (!isManual || hasReportedError) return;
      hasReportedError = true;
      void report("failed");
    });
  }
  function getState() {
    return state;
  }
  return {
    getState,
    restart,
    /** @param {boolean} [isUserRequested] */
    async check(isUserRequested = false) {
      if (!enabled) {
        if (isUserRequested) await report("unavailable");
        return;
      }
      if (state === "ready") {
        if (isUserRequested) await report("ready");
        return;
      }
      if (isChecking) return;
      isChecking = true;
      isManual = isUserRequested;
      hasReportedError = false;
      setState("checking");
      try {
        const result = await updater.checkForUpdates();
        await result?.downloadPromise;
      } catch {
        if (getState() !== "ready") setState("failed");
        if (isManual && !hasReportedError) await report("failed");
      } finally {
        isChecking = false;
        isManual = false;
      }
    },
  };
}

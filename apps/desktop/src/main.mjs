import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { app, BrowserWindow, dialog, Menu, session, shell } from "electron";
import electronUpdater from "electron-updater";

import {
  isUpdateHome,
  parseUpdateNavigation,
  updateBridgeScript,
} from "../generated/update-bridge.mjs";
import { runtimeOrigin, validateFeed } from "./config.mjs";
import { offlineHtml, pageLocale, selectLocale } from "./localization.mjs";
import {
  isAppBlob,
  isAppUrl,
  isBotChallengeFrame,
  isCancelledLoad,
  isExternalUrl,
  isPdfViewerFrame,
  mayDownload,
  mayRequestLocation,
  mayRequestNotifications,
  secureWebPreferences,
} from "./policy.mjs";
import { setupUpdates } from "./updates.mjs";

const config = JSON.parse(
  readFileSync(new URL("../generated/config.json", import.meta.url), "utf8"),
);
/** @type {Record<string, import('./localization.mjs').Messages>} */
const catalogues = JSON.parse(
  readFileSync(new URL("../generated/messages.json", import.meta.url), "utf8"),
);
const origin = runtimeOrigin(config, app.isPackaged, process.env);
/** @type {{mainWindow: BrowserWindow | null, locale: string, home: string}} */
const state = { mainWindow: null, locale: "en", home: origin };
const offlineWindows = new WeakSet();
/** Grants last only for this process and this trusted webContents. */
const locationGrants = new Set();
/** Desktop alerts are opt-in, process-local and distinct from location access. */
const notificationGrants = new Set();
const notificationPrompts = new Set();
const updateSession = { token: randomUUID(), activeDownloads: 0 };
// Permission replies expire on full and in-page navigation, even away and back.
const permissionSession = { generation: 0 };

/** @param {import('./updates.mjs').UpdateState} [updateState] */
function publishUpdate(updateState = updates.getState()) {
  const contents = stateWindow();
  if (!contents) return;
  void contents
    .executeJavaScript(
      updateBridgeScript(origin, updateSession.token, updateState, "desktop"),
    )
    .catch(() => {
      /* Navigation may discard this status; the next load resends it. */
    });
}

function stateWindow() {
  const contents = state.mainWindow?.webContents;
  return contents &&
    !contents.isDestroyed() &&
    isAppUrl(contents.getURL(), origin)
    ? contents
    : null;
}

async function canRestart() {
  const contents = stateWindow();
  if (
    !contents ||
    updateSession.activeDownloads ||
    BrowserWindow.getAllWindows().length !== 1 ||
    !isUpdateHome(contents.getURL(), origin) ||
    contents.isLoading()
  )
    return false;
  const url = contents.getURL();
  const token = updateSession.token;
  const deadline = await contents.executeJavaScript(
    "window.lumaAppUpdates && (window.lumaAppUpdates.isRestartPending() || window.lumaAppUpdates.prepareRestart()) ? window.lumaAppUpdates.getRestartDeadline() : 0",
  );
  return (
    Number.isSafeInteger(deadline) &&
    deadline > Date.now() &&
    contents === stateWindow() &&
    token === updateSession.token &&
    contents.getURL() === url &&
    updateSession.activeDownloads === 0 &&
    !contents.isLoading()
  );
}
/** @returns {import('./localization.mjs').Messages} */
const messages = () => catalogues[state.locale] ?? catalogues.en;

/** @param {string} url */
async function openExternal(url) {
  if (!isExternalUrl(url)) return;
  try {
    await shell.openExternal(url);
  } catch (error) {
    console.error("Could not open external URL", error);
  }
}

/** @param {BrowserWindow} window @param {string} url */
async function loadApp(window, url) {
  if (!isAppUrl(url, origin)) return;
  try {
    offlineWindows.delete(window);
    await window.loadURL(url);
  } catch (error) {
    if (!isCancelledLoad(error)) await showOffline(window);
  }
}
/** @param {BrowserWindow} window */
async function showOffline(window) {
  if (
    window.isDestroyed() ||
    window.webContents.isDestroyed() ||
    offlineWindows.has(window)
  )
    return;
  offlineWindows.add(window);
  try {
    const html = offlineHtml(messages(), state.locale, state.home);
    await window.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    );
  } catch (error) {
    console.error("Could not display offline screen", error);
  }
}

/** @param {BrowserWindow} window @param {boolean} [isDocumentViewer] */
function attachGuards(window, isDocumentViewer = false) {
  const contents = window.webContents;
  contents.on("will-attach-webview", (event) => event.preventDefault());
  contents.on("will-navigate", (event, url) => {
    if (url.startsWith("lumagreen-update:")) {
      event.preventDefault();
      const action = parseUpdateNavigation(url, updateSession.token);
      if (isDocumentViewer || !action || contents !== stateWindow()) return;
      if (action === "restart") void updates.restart();
      else if (action === "check") void updates.check();
      else publishUpdate();
      return;
    }
    if (isDocumentViewer ? isAppBlob(url, origin) : isAppUrl(url, origin)) {
      if (!isDocumentViewer && offlineWindows.has(window)) {
        event.preventDefault();
        void loadApp(window, url);
      }
      return;
    }
    event.preventDefault();
    if (state.mainWindow && isAppUrl(url, origin))
      void loadApp(state.mainWindow, url);
    else if (isExternalUrl(url)) void openExternal(url);
  });
  contents.on("will-redirect", (event, url, _isInPlace, isMainFrame) => {
    if (
      !isDocumentViewer &&
      isAppUrl(contents.getURL(), origin) &&
      isBotChallengeFrame(url, isMainFrame)
    )
      return;
    if (!(isDocumentViewer ? isAppBlob(url, origin) : isAppUrl(url, origin)))
      event.preventDefault();
  });
  contents.on("will-frame-navigate", (event) => {
    if (event.isMainFrame) return;
    if (
      !isDocumentViewer &&
      isAppUrl(contents.getURL(), origin) &&
      isBotChallengeFrame(event.url, event.isMainFrame)
    )
      return;
    if (
      isDocumentViewer &&
      isPdfViewerFrame(event.url, contents.getURL(), origin)
    )
      return;
    if (!isAppUrl(event.url, origin) && !isAppBlob(event.url, origin))
      event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("lumagreen-update:")) {
      const action = parseUpdateNavigation(url, updateSession.token);
      if (!isDocumentViewer && action && contents === stateWindow()) {
        if (action === "restart") void updates.restart();
        else if (action === "check") void updates.check();
        else publishUpdate();
      }
      return { action: "deny" };
    }
    // The authenticated app fetches private PDFs into same-origin blobs.
    if (
      !isDocumentViewer &&
      isAppUrl(contents.getURL(), origin) &&
      isAppBlob(url, origin)
    ) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 900,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: {
            ...secureWebPreferences,
            // Chromium's built-in PDF viewer requires plugins in this document window.
            plugins: true,
            session: contents.session,
          },
        },
      };
    }
    if (state.mainWindow && isAppUrl(url, origin))
      void loadApp(state.mainWindow, url);
    else if (isExternalUrl(url)) void openExternal(url);
    return { action: "deny" };
  });
  contents.on("did-create-window", (child) => {
    child.setMenu(null);
    attachGuards(child, true);
  });
  contents.on("destroyed", () => {
    locationGrants.delete(contents.id);
    notificationGrants.delete(contents.id);
    notificationPrompts.delete(contents.id);
  });
  if (isDocumentViewer) {
    return;
  }
  contents.on("did-start-navigation", (_event, url, isInPlace, isMainFrame) => {
    if (!isMainFrame || isInPlace) return;
    permissionSession.generation += 1;
    if (isAppUrl(url, origin)) updateSession.token = randomUUID();
  });
  contents.on("did-finish-load", () => publishUpdate());

  contents.on(
    "did-fail-load",
    (_event, code, _description, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) void showOffline(window);
    },
  );
  contents.on("render-process-gone", () => {
    void showOffline(window);
  });
  contents.on("did-navigate", (_event, url) => updateLocale(url));
  contents.on("did-navigate-in-page", (_event, url, isMainFrame) => {
    if (isMainFrame) permissionSession.generation += 1;
    updateLocale(url);
  });
}

/** @param {string} url */
function updateLocale(url) {
  if (!isAppUrl(url, origin)) return;
  state.locale = pageLocale(url, catalogues, state.locale);
  state.home = `${origin}/${state.locale === "en" ? "" : state.locale}`;
  setMenu();
}

const updates = setupUpdates(
  electronUpdater.autoUpdater,
  validateFeed(config.updateUrl ?? undefined),
  app.isPackaged && config.release,
  async (state) => {
    const m = messages();
    const keys = {
      ready: "updateReady",
      current: "updateCurrent",
      unavailable: "updateUnavailable",
      failed: "updateFailed",
      blocked: "updateBusy",
      idle: "updates",
      checking: "updates",
    };
    const result = await dialog.showMessageBox({
      type: state === "failed" ? "warning" : "info",
      title: m.native.updates,
      message: m.native[keys[state]],
      buttons:
        state === "ready"
          ? [m.native.restart, m.native.later]
          : [m.common.close],
      defaultId: state === "ready" ? 1 : 0,
      cancelId: state === "ready" ? 1 : 0,
    });
    return state === "ready" && result.response === 0;
  },
  publishUpdate,
  canRestart,
);

function setMenu() {
  const m = messages();
  /** @type {import('electron').MenuItemConstructorOptions[]} */
  const template = [
    ...(process.platform === "darwin"
      ? [{ role: /** @type {const} */ ("appMenu") }]
      : []),
    {
      label: m.brand.name,
      submenu: [
        {
          label: m.nav.home,
          accelerator: "CmdOrCtrl+Home",
          click: () => {
            if (state.mainWindow) void loadApp(state.mainWindow, state.home);
          },
        },
        {
          label: m.native.back,
          accelerator: "Alt+Left",
          click: () => {
            if (state.mainWindow?.webContents.navigationHistory.canGoBack())
              state.mainWindow.webContents.navigationHistory.goBack();
          },
        },
        {
          label: m.native.reload,
          accelerator: "CmdOrCtrl+R",
          click: () => {
            if (state.mainWindow)
              void loadApp(
                state.mainWindow,
                isAppUrl(state.mainWindow.webContents.getURL(), origin)
                  ? state.mainWindow.webContents.getURL()
                  : state.home,
              );
          },
        },
        {
          label: m.native.openBrowser,
          click: () => {
            void openExternal(
              state.mainWindow &&
                isAppUrl(state.mainWindow.webContents.getURL(), origin)
                ? state.mainWindow.webContents.getURL()
                : state.home,
            );
          },
        },
        {
          label: m.native.updates,
          click: () => {
            void updates.check(true);
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** @param {import('electron').WebContents} contents
 * @param {import('electron').PermissionRequest} details
 * @param {(granted: boolean) => void} callback */
function requestNotifications(contents, details, callback) {
  const allowed = mayRequestNotifications(
    details.requestingUrl,
    contents.getURL(),
    origin,
    details.isMainFrame,
    contents === state.mainWindow?.webContents,
  );
  if (!allowed || notificationPrompts.has(contents.id)) {
    callback(false);
    return;
  }
  if (notificationGrants.has(contents.id)) {
    callback(true);
    return;
  }
  const requestedUrl = contents.getURL();
  const requestGeneration = permissionSession.generation;
  const m = messages();
  notificationPrompts.add(contents.id);
  void dialog
    .showMessageBox({
      type: "question",
      title: m.notifications.title,
      message: m.notifications.permissionBody,
      buttons: [m.native.deny, m.native.allow],
      defaultId: 0,
      cancelId: 0,
    })
    .then(({ response }) => {
      const isGrant =
        response === 1 &&
        !contents.isDestroyed() &&
        contents.getURL() === requestedUrl &&
        permissionSession.generation === requestGeneration &&
        contents === state.mainWindow?.webContents;
      if (isGrant) notificationGrants.add(contents.id);
      callback(isGrant);
    })
    .catch(() => callback(false))
    .finally(() => notificationPrompts.delete(contents.id));
}

function configureSession() {
  const browserSession = session.fromPartition(
    config.demo ? "persist:luma-green-demo" : "persist:luma-green",
  );
  browserSession.setPermissionCheckHandler(
    (contents, permission, requestingOrigin, details) => {
      return permission === "notifications"
        ? contents !== null &&
            notificationGrants.has(contents.id) &&
            mayRequestNotifications(
              details.requestingUrl || requestingOrigin,
              contents.getURL(),
              origin,
              details.isMainFrame,
              contents === state.mainWindow?.webContents,
            )
        : contents !== null &&
            locationGrants.has(contents.id) &&
            mayRequestLocation(
              permission,
              details.requestingUrl || requestingOrigin,
              contents.getURL(),
              origin,
              details.isMainFrame,
              contents === state.mainWindow?.webContents,
            );
    },
  );
  browserSession.setPermissionRequestHandler(
    (contents, permission, callback, details) => {
      if (permission === "notifications") {
        requestNotifications(contents, details, callback);
        return;
      }
      if (
        !mayRequestLocation(
          permission,
          details.requestingUrl,
          contents.getURL(),
          origin,
          details.isMainFrame,
          contents === state.mainWindow?.webContents,
        )
      ) {
        callback(false);
        return;
      }
      if (locationGrants.has(contents.id)) {
        callback(true);
        return;
      }
      const m = messages();
      const requestedUrl = contents.getURL();
      const requestGeneration = permissionSession.generation;
      void dialog
        .showMessageBox({
          type: "question",
          title: m.native.locationTitle,
          message: m.native.locationBody,
          buttons: [m.native.deny, m.native.allow],
          defaultId: 0,
          cancelId: 0,
        })
        .then(({ response }) => {
          const isAllowed =
            response === 1 &&
            !contents.isDestroyed() &&
            contents === state.mainWindow?.webContents &&
            contents.getURL() === requestedUrl &&
            permissionSession.generation === requestGeneration;
          if (isAllowed) locationGrants.add(contents.id);
          callback(isAllowed);
        })
        .catch(() => callback(false));
    },
  );
  browserSession.on("will-download", (event, item, contents) => {
    if (!contents || !mayDownload(item.getURL(), contents.getURL(), origin)) {
      event.preventDefault();
      return;
    }
    updateSession.activeDownloads += 1;
    item.once("done", () => {
      updateSession.activeDownloads -= 1;
    });
    // Allowed items retain Electron's native save dialog; no forced filesystem path.
  });
}

function createWindow() {
  const browserSession = session.fromPartition(
    config.demo ? "persist:luma-green-demo" : "persist:luma-green",
  );
  state.mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 360,
    minHeight: 540,
    title: messages().brand.name,
    webPreferences: { ...secureWebPreferences, session: browserSession },
  });
  attachGuards(state.mainWindow);
  state.mainWindow.on("closed", () => {
    state.mainWindow = null;
  });
  setMenu();
  void loadApp(state.mainWindow, state.home);
}

if (app.requestSingleInstanceLock()) {
  app.on("second-instance", () => {
    state.mainWindow?.restore();
    state.mainWindow?.focus();
  });
  void app
    .whenReady()
    .then(() => {
      if (process.platform === "win32")
        app.setAppUserModelId(
          config.demo ? "green.luma.desktop.demo" : "green.luma.desktop",
        );
      state.locale = selectLocale(app.getLocale(), catalogues);
      state.home = `${origin}/${state.locale === "en" ? "" : state.locale}`;
      configureSession();
      createWindow();
      void updates.check();
      const timer = setInterval(
        () => {
          void updates.check();
        },
        6 * 60 * 60 * 1000,
      );
      timer.unref();
      app.on("activate", () => {
        if (!state.mainWindow || state.mainWindow.isDestroyed()) createWindow();
      });
    })
    .catch((error) => {
      console.error("Desktop startup failed", error);
      app.quit();
    });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
} else {
  app.quit();
}

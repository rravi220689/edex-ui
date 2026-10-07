const signale = require("signale");
const {app, BrowserWindow, dialog, shell} = require("electron");
const fs = require("fs");
const path = require("path");

const debugLogFile = "C:\\Users\\Avinash\\.gemini\\antigravity\\scratch\\edex_debug.log";
function debugLog(msg) {
    try {
        fs.appendFileSync(debugLogFile, `[${new Date().toISOString()}] ${msg}\n`);
    } catch(e) {}
}

process.on("uncaughtException", e => {
    let msg = (e && e.message) ? e.message : String(e);
    debugLog(`[BOOT UNCAUGHT EXCEPTION] ${msg}\n${e && e.stack}`);
    if (/ETIMEDOUT|ENOTFOUND|ECONNRESET|ECONNREFUSED|Socket timeout|Cannot read property 'send'|Cannot read property 'isDestroyed'|Cannot read properties of undefined|systeminformation|isDestroyed/i.test(msg)) {
        signale.warn("Suppressed non-fatal background error:", msg);
        return;
    }
    signale.fatal(e);
    if (!win || (typeof win.isDestroyed === "function" && win.isDestroyed())) {
        dialog.showErrorBox("eDEX-UI crashed", msg || "Cannot retrieve error message.");
        if (typeof tty !== "undefined" && tty) {
            tty.close();
        }
        if (typeof extraTtys !== "undefined" && extraTtys) {
            Object.keys(extraTtys).forEach(key => {
                if (extraTtys[key] !== null) {
                    extraTtys[key].close();
                }
            });
        }
        process.exit(1);
    }
});

signale.start(`Starting eDEX-UI v${app.getVersion()}`);
signale.info(`With Node ${process.versions.node} and Electron ${process.versions.electron}`);
signale.info(`Renderer is Chrome ${process.versions.chrome}`);
debugLog(`Boot started: v${app.getVersion()}, Node ${process.versions.node}, Electron ${process.versions.electron}`);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    debugLog("Single instance lock FAILED. Another instance is running.");
    signale.fatal("Error: Another instance of eDEX is already running. Cannot proceed.");
    app.exit(1);
}

signale.time("Startup");

const electron = require("electron");
require('@electron/remote/main').initialize()
const ipc = electron.ipcMain;
const url = require("url");
const which = require("which");
const Terminal = require("./classes/terminal.class.js").Terminal;

ipc.on("log", (e, type, content) => {
    signale[type](content);
    debugLog(`[RENDERER IPC LOG ${type}] ${content}`);
});

var win, tty, extraTtys;
const settingsFile = path.join(electron.app.getPath("userData"), "settings.json");
const shortcutsFile = path.join(electron.app.getPath("userData"), "shortcuts.json");
const lastWindowStateFile = path.join(electron.app.getPath("userData"), "lastWindowState.json");
const themesDir = path.join(electron.app.getPath("userData"), "themes");
const innerThemesDir = path.join(__dirname, "assets/themes");
const kblayoutsDir = path.join(electron.app.getPath("userData"), "keyboards");
const innerKblayoutsDir = path.join(__dirname, "assets/kb_layouts");
const fontsDir = path.join(electron.app.getPath("userData"), "fonts");
const innerFontsDir = path.join(__dirname, "assets/fonts");

// Unset proxy env variables to avoid connection problems on the internal websockets
// See #222
if (process.env.http_proxy) delete process.env.http_proxy;
if (process.env.https_proxy) delete process.env.https_proxy;

// Bypass GPU acceleration blocklist to enable WebGL and software rasterizer
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-webgl");
app.commandLine.appendSwitch("enable-webgl2-compute-context");
if (process.platform === "linux") {
    app.commandLine.appendSwitch("enable-gpu-rasterization");
    app.commandLine.appendSwitch("enable-video-decode");
}

// Support disabling hardware acceleration for VMs / Basic Display Adapter
try {
    let shouldDisableGPU = process.argv.includes("--disable-gpu") || process.env.EDEX_DISABLE_GPU === "1";
    if (!shouldDisableGPU && fs.existsSync(settingsFile)) {
        let loadedSettings = JSON.parse(fs.readFileSync(settingsFile, "utf-8"));
        if (loadedSettings.disableGPU === true) {
            shouldDisableGPU = true;
        }
    }
    if (shouldDisableGPU) {
        app.disableHardwareAcceleration();
        app.commandLine.appendSwitch("disable-gpu");
        app.commandLine.appendSwitch("disable-gpu-compositing");
        app.commandLine.appendSwitch("disable-gpu-rasterization");
        app.commandLine.appendSwitch("disable-gpu-process-crash-limit");
        signale.info("Hardware acceleration disabled (safe software rendering active)");
    }
} catch(e) {
    signale.warn("Error setting GPU flags:", e);
}

// Fix userData folder not setup on Windows
try {
    fs.mkdirSync(electron.app.getPath("userData"));
    signale.info(`Created config dir at ${electron.app.getPath("userData")}`);
} catch(e) {
    signale.info(`Base config dir is ${electron.app.getPath("userData")}`);
}
// Create default settings file
if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify({
        shell: (process.platform === "win32") ? "powershell.exe" : "bash",
        shellArgs: '',
        cwd: electron.app.getPath("userData"),
        keyboard: "en-US",
        theme: "tron",
        termFontSize: 15,
        audio: true,
        audioVolume: 1.0,
        disableFeedbackAudio: false,
        clockHours: 24,
        pingAddr: "1.1.1.1",
        port: 3450,
        nointro: false,
        nocursor: false,
        forceFullscreen: true,
        allowWindowed: true,
        excludeThreadsFromToplist: true,
        hideDotfiles: false,
        fsListView: false,
        disableGPU: false,
        experimentalGlobeFeatures: false,
        experimentalFeatures: false
    }, "", 4));
    signale.info(`Default settings written to ${settingsFile}`);
}
// Create default shortcuts file
if (!fs.existsSync(shortcutsFile)) {
    fs.writeFileSync(shortcutsFile, JSON.stringify([
        { type: "app", trigger: "Ctrl+Shift+C", action: "COPY", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+V", action: "PASTE", enabled: true },
        { type: "app", trigger: "Ctrl+Tab", action: "NEXT_TAB", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+Tab", action: "PREVIOUS_TAB", enabled: true },
        { type: "app", trigger: "Ctrl+X", action: "TAB_X", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+S", action: "SETTINGS", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+K", action: "SHORTCUTS", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+F", action: "FUZZY_SEARCH", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+L", action: "FS_LIST_VIEW", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+H", action: "FS_DOTFILES", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+P", action: "KB_PASSMODE", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+I", action: "DEV_DEBUG", enabled: false },
        { type: "app", trigger: "Ctrl+Shift+F5", action: "DEV_RELOAD", enabled: true },
        { type: "shell", trigger: "Ctrl+Shift+Alt+Space", action: "neofetch", linebreak: true, enabled: false }
    ], "", 4));
    signale.info(`Default keymap written to ${shortcutsFile}`);
}
//Create default window state file
if(!fs.existsSync(lastWindowStateFile)) {
    fs.writeFileSync(lastWindowStateFile, JSON.stringify({
        useFullscreen: true
    }, "", 4));
    signale.info(`Default last window state written to ${lastWindowStateFile}`);
}

// Copy default themes & keyboard layouts & fonts
signale.pending("Mirroring internal assets...");
try {
    fs.mkdirSync(themesDir);
} catch(e) {
    // Folder already exists
}
fs.readdirSync(innerThemesDir).forEach(e => {
    fs.writeFileSync(path.join(themesDir, e), fs.readFileSync(path.join(innerThemesDir, e), {encoding:"utf-8"}));
});
try {
    fs.mkdirSync(kblayoutsDir);
} catch(e) {
    // Folder already exists
}
fs.readdirSync(innerKblayoutsDir).forEach(e => {
    fs.writeFileSync(path.join(kblayoutsDir, e), fs.readFileSync(path.join(innerKblayoutsDir, e), {encoding:"utf-8"}));
});
try {
    fs.mkdirSync(fontsDir);
} catch(e) {
    // Folder already exists
}
fs.readdirSync(innerFontsDir).forEach(e => {
    fs.writeFileSync(path.join(fontsDir, e), fs.readFileSync(path.join(innerFontsDir, e)));
});

// Version history logging
const versionHistoryPath = path.join(electron.app.getPath("userData"), "versions_log.json");
var versionHistory = fs.existsSync(versionHistoryPath) ? require(versionHistoryPath) : {};
var version = app.getVersion();
if (typeof versionHistory[version] === "undefined") {
	versionHistory[version] = {
		firstSeen: Date.now(),
		lastSeen: Date.now()
	};
} else {
	versionHistory[version].lastSeen = Date.now();
}
fs.writeFileSync(versionHistoryPath, JSON.stringify(versionHistory, 0, 2), {encoding:"utf-8"});

function createWindow(settings) {
    signale.info("Creating window...");

    let display;
    if (!isNaN(settings.monitor)) {
        display = electron.screen.getAllDisplays()[settings.monitor] || electron.screen.getPrimaryDisplay();
    } else {
        display = electron.screen.getPrimaryDisplay();
    }
    let {x, y, width, height} = display.bounds;
    width++; height++;
    win = new BrowserWindow({
        title: "eDEX-UI",
        x,
        y,
        width,
        height,
        show: false,
        resizable: true,
        movable: settings.allowWindowed || false,
        fullscreen: settings.forceFullscreen || false,
        autoHideMenuBar: true,
        frame: settings.allowWindowed || false,
        backgroundColor: '#000000',
        webPreferences: {
            devTools: true,
	    enableRemoteModule: true,
            contextIsolation: false,
            backgroundThrottling: false,
            webSecurity: true,
            nodeIntegration: true,
            nodeIntegrationInSubFrames: false,
            allowRunningInsecureContent: false,
            webviewTag: true,
            experimentalFeatures: settings.experimentalFeatures || false
        }
    });

    try {
        const remoteMain = require('@electron/remote/main');
        if (typeof remoteMain.enable === "function") {
            remoteMain.enable(win.webContents);
        }
    } catch(e) {
        signale.warn("Failed to enable remote on webContents:", e);
    }

    win.webContents.on('crashed', (event, killed) => {
        debugLog(`[RENDER CRASHED] killed: ${killed}`);
        signale.fatal('Renderer crashed! killed:', killed);
    });
    win.webContents.on('render-process-gone', (event, details) => {
        debugLog(`[RENDER PROCESS GONE] reason: ${details.reason}, exitCode: ${details.exitCode}`);
        signale.fatal(`Render process gone! reason: ${details.reason}, exitCode: ${details.exitCode}`);
    });
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        debugLog(`[FAILED LOAD UI.HTML] code: ${errorCode}, desc: ${errorDescription}`);
        signale.fatal(`Failed to load ui.html: ${errorCode} ${errorDescription}`);
    });
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
        debugLog(`[RENDER CONSOLE L${level}] ${message} (${sourceId}:${line})`);
        signale.info(`[Renderer] [L${level}] ${message} (${sourceId}:${line})`);
    });
    win.on('close', () => {
        debugLog('[WINDOW EVENT CLOSE]');
    });
    win.on('closed', () => {
        debugLog('[WINDOW EVENT CLOSED]');
    });

    win.loadURL(url.format({
        pathname: path.join(__dirname, 'ui.html'),
        protocol: 'file:',
        slashes: true
    }));

    signale.complete("Frontend window created!");
    debugLog("Frontend window created and show() called");
    win.show();
    if (!settings.allowWindowed) {
        win.setResizable(false);
    } else if (!require(lastWindowStateFile)["useFullscreen"]) {
        win.setFullScreen(false);
    }

    signale.watch("Waiting for frontend connection...");
}

app.on('ready', async () => {
    signale.pending(`Loading settings file...`);
    let settings = require(settingsFile);
    signale.pending(`Resolving shell path...`);
    settings.shell = await which(settings.shell).catch(e => { throw(e) });
    signale.info(`Shell found at ${settings.shell}`);
    signale.success(`Settings loaded!`);

    if (!require("fs").existsSync(settings.cwd)) throw new Error("Configured cwd path does not exist.");

    // See #366
    let cleanEnv = await require("shell-env")(settings.shell).catch(e => { throw e; });

    Object.assign(cleanEnv, {
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        TERM_PROGRAM: "eDEX-UI",
        TERM_PROGRAM_VERSION: app.getVersion()
    }, settings.env);

    signale.pending(`Creating new terminal process on port ${settings.port || '3450'}`);
    tty = new Terminal({
        role: "server",
        shell: settings.shell,
        params: settings.shellArgs || '',
        cwd: settings.cwd,
        env: cleanEnv,
        port: settings.port || 3450
    });
    signale.success(`Terminal back-end initialized!`);
    tty.onclosed = (code, signal) => {
        debugLog(`[TTY ONCLOSED] code: ${code}, signal: ${signal}`);
        tty.ondisconnected = () => {};
        signale.complete("Terminal exited", code, signal);
        // Retain eDEX-UI alive so that AI Core, browser, and UI controls remain accessible
    };
    tty.onopened = () => {
        debugLog(`[TTY ONOPENED Connected to frontend]`);
        signale.success("Connected to frontend!");
        signale.timeEnd("Startup");
    };
    tty.onresized = (cols, rows) => {
        signale.info("Resized TTY to ", cols, rows);
    };
    tty.ondisconnected = () => {
        debugLog(`[TTY ONDISCONNECTED Lost connection to frontend]`);
        signale.error("Lost connection to frontend");
        signale.watch("Waiting for frontend connection...");
    };

    // Support for multithreaded systeminformation calls
    signale.pending("Starting multithreaded calls controller...");
    require("./_multithread.js");

    createWindow(settings);

    // Support for more terminals, used for creating tabs (currently limited to 4 extra terms)
    extraTtys = {};
    let basePort = settings.port || 3450;
    basePort = Number(basePort) + 2;

    for (let i = 0; i < 4; i++) {
        extraTtys[basePort+i] = null;
    }

    ipc.on("ttyspawn", (e, arg) => {
        let port = null;
        Object.keys(extraTtys).forEach(key => {
            if (extraTtys[key] === null && port === null) {
                extraTtys[key] = {};
                port = key;
            }
        });

        if (port === null) {
            signale.error("TTY spawn denied (Reason: exceeded max TTYs number)");
            e.sender.send("ttyspawn-reply", "ERROR: max number of ttys reached");
        } else {
            signale.pending(`Creating new TTY process on port ${port}`);
            let term = new Terminal({
                role: "server",
                shell: settings.shell,
                params: settings.shellArgs || '',
                cwd: tty.tty._cwd || settings.cwd,
                env: cleanEnv,
                port: port
            });
            signale.success(`New terminal back-end initialized at ${port}`);
            term.onclosed = (code, signal) => {
                term.ondisconnected = () => {};
                term.wss.close();
                signale.complete(`TTY exited at ${port}`, code, signal);
                extraTtys[term.port] = null;
                term = null;
            };
            term.onopened = pid => {
                signale.success(`TTY ${port} connected to frontend (process PID ${pid})`);
            };
            term.onresized = () => {};
            term.ondisconnected = () => {
                term.onclosed = () => {};
                term.close();
                term.wss.close();
                extraTtys[term.port] = null;
                term = null;
            };

            extraTtys[port] = term;
            e.sender.send("ttyspawn-reply", "SUCCESS: "+port);
        }
    });

    // Backend support for theme and keyboard hotswitch
    let themeOverride = null;
    let kbOverride = null;
    ipc.on("getThemeOverride", (e, arg) => {
        e.sender.send("getThemeOverride", themeOverride);
    });
    ipc.on("getKbOverride", (e, arg) => {
        e.sender.send("getKbOverride", kbOverride);
    });
    ipc.on("setThemeOverride", (e, arg) => {
        themeOverride = arg;
    });
    ipc.on("setKbOverride", (e, arg) => {
        kbOverride = arg;
    });
});

app.on('web-contents-created', (e, contents) => {
    if (contents.getType() === 'webview') {
        contents.on('new-window', (event, url) => {
            event.preventDefault();
            contents.loadURL(url);
        });
        return;
    }

    // Prevent creating more than one window for main UI
    contents.on('new-window', (e, url) => {
        e.preventDefault();
        shell.openExternal(url);
    });

    // Prevent loading something else than the UI
    contents.on('will-navigate', (e, url) => {
        if (url !== contents.getURL()) e.preventDefault();
    });
});

app.on('window-all-closed', () => {
    debugLog("[APP WINDOW ALL CLOSED]");
    signale.info("All windows closed");
    app.quit();
});

app.on('before-quit', () => {
    debugLog("[APP BEFORE QUIT]");
    tty.close();
    Object.keys(extraTtys).forEach(key => {
        if (extraTtys[key] !== null) {
            extraTtys[key].close();
        }
    });
    signale.complete("Shutting down...");
});

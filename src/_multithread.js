const cluster = require("cluster");

if (cluster.isMaster) {
    const electron = require("electron");
    const ipc = electron.ipcMain;
    const signale = require("signale");
    // Also, leave a core available for the renderer process
    const osCPUs = require("os").cpus().length - 1;
    // See #904
    const numCPUs = (osCPUs > 7) ? 7 : (osCPUs < 1 ? 1 : osCPUs);

    const si = require("systeminformation");

    cluster.setupMaster({
        exec: require("path").join(__dirname, "_multithread.js")
    });

    cluster.on("exit", (worker, code, signal) => {
        signale.warn(`Systeminformation worker ${worker.id} exited (${code || signal}). Respawning...`);
        try {
            cluster.fork();
        } catch(e) {
            signale.warn("Failed to respawn worker:", e);
        }
    });

    for (let i = 0; i < numCPUs; i++) {
        try {
            cluster.fork();
        } catch(e) {
            signale.warn("Failed to fork worker:", e);
        }
    }

    signale.success("Multithreaded controller ready");

    var lastID = 0;

    function getAvailableWorker() {
        if (!cluster.workers) return null;
        const activeWorkers = Object.values(cluster.workers).filter(w => w && typeof w.isConnected === "function" && w.isConnected() && typeof w.isDead === "function" && !w.isDead());
        if (activeWorkers.length === 0) return null;
        lastID = (lastID + 1) % activeWorkers.length;
        return activeWorkers[lastID];
    }

    function dispatch(type, id, arg) {
        const worker = getAvailableWorker();
        if (worker && typeof worker.send === "function") {
            try {
                worker.send(JSON.stringify({
                    id,
                    type,
                    arg
                }));
                return true;
            } catch(e) {
                signale.warn("Failed to send message to worker:", e);
            }
        }
        return false;
    }

    var queue = {};

    function fallbackCall(e, type, id, ...args) {
        if (!si[type] || typeof si[type] !== "function") {
            if (e && e.sender && !e.sender.isDestroyed()) {
                e.sender.send("systeminformation-reply-" + id, null);
            }
            return;
        }
        try {
            si[type](...args).then(res => {
                if (e && e.sender && !e.sender.isDestroyed()) {
                    e.sender.send("systeminformation-reply-" + id, res);
                }
            }).catch(() => {
                if (e && e.sender && !e.sender.isDestroyed()) {
                    e.sender.send("systeminformation-reply-" + id, null);
                }
            });
        } catch(err) {
            if (e && e.sender && !e.sender.isDestroyed()) {
                e.sender.send("systeminformation-reply-" + id, null);
            }
        }
    }

    ipc.on("systeminformation-call", (e, type, id, ...args) => {
        if (!si[type] || typeof si[type] !== "function") {
            signale.warn("Illegal request for systeminformation:", type);
            return;
        }

        if (args.length > 1) {
            fallbackCall(e, type, id, ...args);
        } else {
            queue[id] = e.sender;
            const dispatched = dispatch(type, id, args[0]);
            if (!dispatched) {
                delete queue[id];
                fallbackCall(e, type, id, ...args);
            }
        }
    });

    cluster.on("message", (worker, rawMsg) => {
        try {
            const msg = (typeof rawMsg === "string") ? JSON.parse(rawMsg) : rawMsg;
            if (msg && msg.id && queue[msg.id]) {
                const targetSender = queue[msg.id];
                delete queue[msg.id];
                if (targetSender && typeof targetSender.isDestroyed === "function" && !targetSender.isDestroyed()) {
                    targetSender.send("systeminformation-reply-" + msg.id, msg.res);
                }
            }
        } catch(e) {
            // Window closed or malformed reply, ignore safely
        }
    });
} else if (cluster.isWorker) {
    const signale = require("signale");
    const si = require("systeminformation");

    signale.info("Multithread worker started at " + process.pid);

    process.on("message", rawMsg => {
        try {
            const msg = (typeof rawMsg === "string") ? JSON.parse(rawMsg) : rawMsg;
            if (msg && msg.type && typeof si[msg.type] === "function") {
                si[msg.type](msg.arg).then(res => {
                    try {
                        process.send(JSON.stringify({
                            id: msg.id,
                            res
                        }));
                    } catch(e) {}
                }).catch(err => {
                    try {
                        process.send(JSON.stringify({
                            id: msg.id,
                            res: null
                        }));
                    } catch(e) {}
                });
            } else {
                try {
                    process.send(JSON.stringify({
                        id: msg ? msg.id : null,
                        res: null
                    }));
                } catch(e) {}
            }
        } catch(err) {
            signale.warn("Worker error processing message:", err);
        }
    });
}

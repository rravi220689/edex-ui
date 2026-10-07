/**
 * eDEX-UI Local Autonomous AI Controller
 * Standalone offline system controller & intelligent automation engine.
 * Does not depend on any cloud or external AI services.
 */

(() => {
    const { exec, spawn } = require("child_process");
    const path = require("path");
    const fs = require("fs");
    const os = require("os");
    const electron = require("electron");

    class AIController {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.history = [];
        this.historyIndex = -1;

        // Render UI layout
        this.renderLayout();

        // Bind interactive events
        this.bindEvents();

        // Display initial greeting briefing
        this.appendGreeting();
    }

    renderLayout() {
        this.container.innerHTML = `
            <div id="ai_hud_header">
                <div id="ai_hud_title">
                    <span style="font-size:1.8vh;">🤖</span>
                    <span>AI CORE // LOCAL AUTONOMOUS CONTROLLER</span>
                </div>
                <div id="ai_hud_badges">
                    <span class="ai_badge online">● SYSTEM ONLINE</span>
                    <span class="ai_badge">AUTONOMOUS OFFLINE</span>
                    <span class="ai_badge">HOST: ${os.hostname().toUpperCase()}</span>
                </div>
            </div>
            <div id="ai_chips_bar">
                <button class="ai_chip" data-cmd="help">❓ HELP & CAPABILITIES</button>
                <button class="ai_chip" data-cmd="top processes">📊 TOP PROCESSES</button>
                <button class="ai_chip" data-cmd="system diagnostics">💻 SYSTEM HEALTH</button>
                <button class="ai_chip" data-cmd="disk space">💾 DISK STORAGE</button>
                <button class="ai_chip" data-cmd="network info">🌐 NETWORK SPECS</button>
                <button class="ai_chip" data-cmd="list themes">🎨 UI THEMES</button>
                <button class="ai_chip" data-cmd="launch calc">🧮 LAUNCH CALC</button>
                <button class="ai_chip" data-cmd="launch notepad">📝 LAUNCH NOTEPAD</button>
                <button class="ai_chip" data-cmd="lock workstation">🔒 LOCK PC</button>
            </div>
            <div id="ai_message_feed"></div>
            <div id="ai_input_toolbar">
                <span id="ai_input_prefix">[AI://SYS]&gt;</span>
                <input type="text" id="ai_input" placeholder="Issue system command (e.g., 'launch notepad', 'kill chrome', 'system diagnostics', 'search file *.pdf')..." autocomplete="off" />
                <button id="ai_btn_send">EXECUTE ↵</button>
            </div>
        `;

        this.feed = document.getElementById("ai_message_feed");
        this.input = document.getElementById("ai_input");
        this.sendBtn = document.getElementById("ai_btn_send");
    }

    bindEvents() {
        if (!this.input || !this.sendBtn) return;

        this.sendBtn.onclick = () => this.submitInput();

        this.input.onkeydown = e => {
            if (e.key === "Enter") {
                this.submitInput();
            } else if (e.key === "ArrowUp") {
                if (this.history.length > 0 && this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                    this.input.value = this.history[this.history.length - 1 - this.historyIndex];
                }
            } else if (e.key === "ArrowDown") {
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    this.input.value = this.history[this.history.length - 1 - this.historyIndex];
                } else if (this.historyIndex === 0) {
                    this.historyIndex = -1;
                    this.input.value = "";
                }
            }
        };

        // Detach keyboard on input focus so physical keys are not sent to background terminal
        this.input.onfocus = () => {
            if (window.keyboard) window.keyboard.detach();
        };

        // Quick action chips
        document.querySelectorAll(".ai_chip").forEach(chip => {
            chip.onclick = () => {
                let cmd = chip.getAttribute("data-cmd");
                if (cmd) {
                    this.input.value = cmd;
                    this.submitInput();
                }
            };
        });
    }

    submitInput() {
        let val = this.input.value.trim();
        if (!val) return;

        this.history.push(val);
        this.historyIndex = -1;
        this.input.value = "";

        this.appendUserMessage(val);
        if (window.audioManager && window.audioManager.stdin) {
            window.audioManager.stdin.play();
        }

        setTimeout(() => {
            this.processCommand(val);
        }, 80);
    }

    appendUserMessage(text) {
        let div = document.createElement("div");
        div.className = "ai_msg user";
        div.innerHTML = `
            <span class="ai_msg_sender">OPERATOR // COMMAND</span>
            <div class="ai_msg_body">${window._escapeHtml(text)}</div>
        `;
        this.feed.appendChild(div);
        this.scrollToBottom();
    }

    appendAIMessage(htmlContent, title = "AI CORE // RESPONSE") {
        let div = document.createElement("div");
        div.className = "ai_msg ai";
        div.innerHTML = `
            <span class="ai_msg_sender">${title}</span>
            <div class="ai_msg_body">${htmlContent}</div>
        `;
        this.feed.appendChild(div);
        this.scrollToBottom();

        if (window.audioManager && window.audioManager.stdout) {
            window.audioManager.stdout.play();
        }
    }

    scrollToBottom() {
        if (this.feed) {
            this.feed.scrollTop = this.feed.scrollHeight;
        }
    }

    appendGreeting() {
        let username = os.userInfo().username || "User";
        let osInfo = `${os.type()} ${os.release()} (${os.arch()})`;
        let html = `
            <div><strong>LOCAL SYSTEM CONTROLLER ONLINE</strong></div>
            <div style="margin: 0.5vh 0; color: #a0b0c0;">
                Greetings, <strong>${window._escapeHtml(username)}</strong>. I am your standalone, offline AI controller for local system management.
                You can operate and automate your system directly from eDEX-UI without switching back to the desktop.
            </div>
            <div class="ai_card">
                <span class="ai_card_title">CORE CONTROLLER CAPABILITIES</span>
                <div style="font-size: 1.15vh; line-height: 1.6; color: #c0c8d0;">
                    • <strong>Application Launcher:</strong> <code>launch notepad</code>, <code>open calc</code>, <code>start code</code>, <code>open taskmgr</code><br/>
                    • <strong>Process Manager:</strong> <code>top processes</code>, <code>kill &lt;pid&gt;</code>, <code>kill process chrome</code><br/>
                    • <strong>File Finder:</strong> <code>search file *.pdf</code>, <code>search file report.docx in C:\\Users</code><br/>
                    • <strong>System Health:</strong> <code>system diagnostics</code>, <code>disk space</code>, <code>network info</code><br/>
                    • <strong>Desktop Session:</strong> <code>lock workstation</code>, <code>sleep</code>, <code>restart</code><br/>
                    • <strong>eDEX Controls:</strong> <code>theme matrix</code>, <code>list themes</code>, <code>browse https://github.com</code><br/>
                    • <strong>Direct Execution:</strong> <code>exec dir</code>, <code>exec ipconfig /all</code>, <code>exec get-service</code>
                </div>
            </div>
            <div style="font-size: 1.1vh; color: rgba(var(--color_r), var(--color_g), var(--color_b), 0.8);">
                Type a natural command below or click any quick action chip above to begin.
            </div>
        `;
        this.appendAIMessage(html, "AI CORE // SYSTEM INITIALIZED");
    }

    async processCommand(rawInput) {
        let input = rawInput.toLowerCase().trim();

        // 1. HELP & CAPABILITIES
        if (/^(help|\?|commands|capabilities|menu)$/i.test(input)) {
            return this.showHelp();
        }

        // 2. LAUNCH / OPEN APPS
        let launchMatch = input.match(/^(?:launch|open|start|run)\s+(.+)$/i);
        if (launchMatch) {
            let target = launchMatch[1].trim();
            // Check if it's a URL first
            if (/^(https?:\/\/|www\.)/i.test(target) || (target.includes(".") && !target.includes(" ") && !target.endsWith(".exe"))) {
                return this.browseUrl(target);
            }
            // Check if it's a file search query
            if (target.startsWith("file ") || target.startsWith("files ")) {
                return this.searchFiles(target.replace(/^files?\s+/, ""));
            }
            return this.launchApp(target);
        }

        // 3. PROCESS CONTROL
        if (/^(?:top\s+processes|processes|process\s+list|ps|tasklist|tasks)$/i.test(input)) {
            return this.listTopProcesses();
        }

        let killMatch = input.match(/^(?:kill|terminate|stop|end)\s+(?:process\s+)?(.+)$/i);
        if (killMatch) {
            return this.killProcess(killMatch[1].trim());
        }

        // 4. FILE SEARCH & STORAGE
        let searchMatch = input.match(/^(?:search|find)\s+(?:file\s+|files\s+)?(.+)$/i);
        if (searchMatch) {
            return this.searchFiles(searchMatch[1].trim());
        }

        if (/^(?:disk|disks|disk\s+space|storage|drives|hdd|ssd)$/i.test(input)) {
            return this.showDiskSpace();
        }

        // 5. SYSTEM HEALTH & DIAGNOSTICS
        if (/^(?:system|system\s+health|diagnostics|specs|status|hardware|sysinfo)$/i.test(input)) {
            return this.showSystemDiagnostics();
        }

        if (/^(?:network|network\s+info|ip|my\s+ip|ipconfig|ifconfig)$/i.test(input)) {
            return this.showNetworkInfo();
        }

        let pingMatch = input.match(/^ping\s+(.+)$/i);
        if (pingMatch) {
            return this.runPing(pingMatch[1].trim());
        }

        // 6. POWER & SESSION
        if (/^(?:lock|lock\s+pc|lock\s+screen|lock\s+workstation)$/i.test(input)) {
            return this.lockWorkstation();
        }

        if (/^(?:restart|reboot|shutdown|sleep)$/i.test(input)) {
            return this.handlePowerAction(input);
        }

        // 7. THEMES & EDEX CONTROLS
        let themeMatch = input.match(/^(?:theme|set\s+theme)\s+(.+)$/i);
        if (themeMatch) {
            return this.setTheme(themeMatch[1].trim());
        }

        if (/^(?:list\s+themes|themes)$/i.test(input)) {
            return this.listThemes();
        }

        let kbMatch = input.match(/^(?:keyboard|set\s+keyboard)\s+(.+)$/i);
        if (kbMatch) {
            return this.setKeyboard(kbMatch[1].trim());
        }

        if (/^(?:mute|unmute|sound\s+on|sound\s+off|audio\s+toggle)$/i.test(input)) {
            return this.toggleAudio();
        }

        // 8. BROWSER
        let browseMatch = input.match(/^(?:browse|web|search\s+web|google)\s+(.+)$/i);
        if (browseMatch) {
            return this.browseUrl(browseMatch[1].trim());
        }

        // 9. SHELL EXECUTION
        let execMatch = input.match(/^(?:exec|run|shell|cmd|powershell)\s+(.+)$/i);
        if (execMatch) {
            return this.executeShell(execMatch[1].trim());
        }

        // 10. NATURAL LANGUAGE SMART ROUTING
        // Check for common natural language queries
        if (input.includes("process") && (input.includes("top") || input.includes("running") || input.includes("cpu"))) {
            return this.listTopProcesses();
        }
        if (input.includes("disk") || input.includes("storage") || input.includes("free space")) {
            return this.showDiskSpace();
        }
        if (input.includes("cpu") || input.includes("memory") || input.includes("ram") || input.includes("battery")) {
            return this.showSystemDiagnostics();
        }
        if (input.includes("ip") || input.includes("network") || input.includes("wifi") || input.includes("internet")) {
            return this.showNetworkInfo();
        }

        // Default: Execute as command or provide intelligent assistance
        this.executeShell(rawInput);
    }

    showHelp() {
        let html = `
            <div><strong>AI CONTROLLER COMMAND REFERENCE</strong></div>
            <div class="ai_card">
                <span class="ai_card_title">1. APPLICATION LAUNCHER</span>
                <div>Launch any installed Windows desktop software without leaving fullscreen eDEX-UI:</div>
                <div style="color: #90d0ff; margin-top: 0.3vh;">
                    • <code>launch notepad</code> • <code>open calc</code> • <code>start code</code> • <code>launch taskmgr</code><br/>
                    • <code>open explorer [path]</code> • <code>open chrome</code> • <code>open edge</code> • <code>launch paint</code>
                </div>
            </div>
            <div class="ai_card">
                <span class="ai_card_title">2. PROCESS MANAGEMENT</span>
                <div>Inspect top resource consumers and terminate processes:</div>
                <div style="color: #90d0ff; margin-top: 0.3vh;">
                    • <code>top processes</code> — View top 8 CPU/Memory processes with instant kill buttons<br/>
                    • <code>kill &lt;pid&gt;</code> — Terminate process by PID (e.g. <code>kill 1234</code>)<br/>
                    • <code>kill process chrome</code> — Terminate process by name
                </div>
            </div>
            <div class="ai_card">
                <span class="ai_card_title">3. FILE SEARCH & STORAGE</span>
                <div style="color: #90d0ff; margin-top: 0.3vh;">
                    • <code>search file *.pdf</code> — Fast recursive search in current directory<br/>
                    • <code>search file report.docx in C:\\Users</code> — Search specific folder<br/>
                    • <code>disk space</code> — Display mount points and storage capacities
                </div>
            </div>
            <div class="ai_card">
                <span class="ai_card_title">4. SYSTEM DIAGNOSTICS & HARDWARE</span>
                <div style="color: #90d0ff; margin-top: 0.3vh;">
                    • <code>system diagnostics</code> — CPU load, RAM allocation, OS uptime<br/>
                    • <code>network info</code> — Local IPv4, MAC address, connection status<br/>
                    • <code>ping 1.1.1.1</code> — Network latency test
                </div>
            </div>
            <div class="ai_card">
                <span class="ai_card_title">5. EDEX CUSTOMIZATION & SYSTEM POWER</span>
                <div style="color: #90d0ff; margin-top: 0.3vh;">
                    • <code>theme matrix</code>, <code>theme tron</code>, <code>list themes</code><br/>
                    • <code>browse https://github.com</code> — Switch to built-in web browser<br/>
                    • <code>lock workstation</code> — Instantly lock Windows desktop<br/>
                    • <code>exec &lt;any command&gt;</code> — Direct PowerShell execution
                </div>
            </div>
        `;
        this.appendAIMessage(html);
    }

    launchApp(target) {
        const knownApps = {
            "notepad": "notepad.exe",
            "calc": "calc.exe",
            "calculator": "calc.exe",
            "code": "code",
            "vscode": "code",
            "taskmgr": "taskmgr.exe",
            "task manager": "taskmgr.exe",
            "explorer": "explorer.exe",
            "files": "explorer.exe",
            "cmd": "cmd.exe",
            "command prompt": "cmd.exe",
            "powershell": "powershell.exe",
            "paint": "mspaint.exe",
            "mspaint": "mspaint.exe",
            "control": "control.exe",
            "control panel": "control.exe",
            "regedit": "regedit.exe",
            "chrome": "start chrome",
            "google chrome": "start chrome",
            "edge": "start msedge",
            "msedge": "start msedge",
            "settings": "start ms-settings:",
            "terminal": "wt.exe",
            "snippingtool": "snippingtool.exe",
            "vlc": "start vlc"
        };

        let cmdToRun = knownApps[target.toLowerCase()] || target;

        try {
            let child = spawn(cmdToRun, [], {
                shell: true,
                detached: true,
                stdio: "ignore"
            });
            child.unref();

            let html = `
                <div style="color:#00ff80;">✓ Executed application launch: <strong>${window._escapeHtml(target)}</strong></div>
                <div style="font-size: 1.15vh; color: #a0b0c0; margin-top: 0.3vh;">
                    Process spawned independently. The application is now running on your desktop.
                </div>
            `;
            this.appendAIMessage(html, "AI CONTROLLER // APP LAUNCHED");
        } catch(e) {
            let html = `
                <div style="color:#ff4455;">✕ Failed to launch: <strong>${window._escapeHtml(target)}</strong></div>
                <div style="font-size: 1.15vh; color: #a0b0c0;">Error: ${window._escapeHtml(e.message)}</div>
            `;
            this.appendAIMessage(html, "AI CONTROLLER // LAUNCH ERROR");
        }
    }

    async listTopProcesses() {
        this.appendAIMessage("<i>Scanning active tasks and resource consumption...</i>", "AI CONTROLLER // PROCESS SCAN");

        try {
            let data = await window.si.processes();
            if (!data || !data.list || !Array.isArray(data.list)) {
                return this.appendAIMessage("Could not retrieve active process list.", "AI CONTROLLER // ERROR");
            }

            // Sort by CPU usage descending
            let sorted = data.list.slice().sort((a, b) => b.cpu - a.cpu).slice(0, 8);

            let rows = sorted.map(p => `
                <tr>
                    <td><strong>${p.pid}</strong></td>
                    <td>${window._escapeHtml(p.name)}</td>
                    <td style="color:${p.cpu > 20 ? '#ff5566' : '#a0e0a0'};">${Math.round(p.cpu)}%</td>
                    <td>${Math.round(p.mem)}%</td>
                    <td>
                        <button class="ai_btn danger" onclick="window.aiController.killProcess('${p.pid}')">KILL</button>
                    </td>
                </tr>
            `).join("");

            let html = `
                <div><strong>TOP RESOURCE CONSUMERS (TOTAL: ${data.all} PROCESSES)</strong></div>
                <table class="ai_table">
                    <thead>
                        <tr>
                            <th>PID</th>
                            <th>PROCESS</th>
                            <th>CPU</th>
                            <th>MEM</th>
                            <th>ACTION</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            `;
            this.appendAIMessage(html, "AI CONTROLLER // PROCESS LIST");
        } catch(e) {
            this.appendAIMessage(`Failed to query process list: ${window._escapeHtml(e.message)}`, "AI CONTROLLER // ERROR");
        }
    }

    killProcess(target) {
        let isPid = /^\d+$/.test(target);
        let killCmd = isPid ? `taskkill /F /PID ${target}` : `taskkill /F /IM "${target.endsWith('.exe') ? target : target + '.exe'}"`;

        exec(killCmd, (err, stdout, stderr) => {
            if (err) {
                let html = `
                    <div style="color:#ff4455;">✕ Failed to terminate process: <strong>${window._escapeHtml(target)}</strong></div>
                    <div style="font-size:1.15vh; color:#a0b0c0;">${window._escapeHtml(stderr || err.message)}</div>
                `;
                return this.appendAIMessage(html, "AI CONTROLLER // KILL PROCESS FAILED");
            }

            let html = `
                <div style="color:#00ff80;">✓ Process terminated: <strong>${window._escapeHtml(target)}</strong></div>
                <div style="font-size:1.15vh; color:#a0b0c0;">${window._escapeHtml(stdout.trim())}</div>
            `;
            this.appendAIMessage(html, "AI CONTROLLER // PROCESS TERMINATED");
        });
    }

    async searchFiles(query) {
        let searchDir = window.settings.cwd || os.homedir();
        // Check if query contains "in <path>"
        let inMatch = query.match(/^(.+?)\s+in\s+([A-Za-z]:\\[^]+|\/[^]+)$/i);
        let pattern = query;
        if (inMatch) {
            pattern = inMatch[1].trim();
            searchDir = inMatch[2].trim();
        }

        this.appendAIMessage(`<i>Searching for <code>${window._escapeHtml(pattern)}</code> in <code>${window._escapeHtml(searchDir)}</code>...</i>`, "AI CONTROLLER // FILE SEARCH");

        // Use PowerShell Get-ChildItem for high-speed file search
        let psCmd = `powershell -NoProfile -Command "Get-ChildItem -Path '${searchDir}' -Filter '${pattern}' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 6 | Select-Object FullName, Length, LastWriteTime | ConvertTo-Json"`;

        exec(psCmd, { maxBuffer: 1024 * 1024 }, (err, stdout) => {
            if (err || !stdout.trim()) {
                let html = `<div>No files matching <strong>${window._escapeHtml(pattern)}</strong> found in ${window._escapeHtml(searchDir)}.</div>`;
                return this.appendAIMessage(html, "AI CONTROLLER // SEARCH RESULTS");
            }

            try {
                let results = JSON.parse(stdout);
                if (!Array.isArray(results)) results = [results];

                let rows = results.map(item => {
                    let fullPath = item.FullName.replace(/\\/g, "\\\\");
                    let sizeKb = Math.round(item.Length / 1024);
                    return `
                        <tr>
                            <td style="word-break:break-all;"><strong>${window._escapeHtml(path.basename(item.FullName))}</strong><br/><span style="font-size:1vh;color:#8090a0;">${window._escapeHtml(item.FullName)}</span></td>
                            <td>${sizeKb} KB</td>
                            <td>
                                <button class="ai_btn" onclick="electron.shell.openPath('${fullPath}')">OPEN</button>
                                <button class="ai_btn" onclick="electron.shell.showItemInFolder('${fullPath}')">REVEAL</button>
                            </td>
                        </tr>
                    `;
                }).join("");

                let html = `
                    <div><strong>SEARCH RESULTS FOR: ${window._escapeHtml(pattern)}</strong></div>
                    <table class="ai_table">
                        <thead>
                            <tr>
                                <th>FILE</th>
                                <th>SIZE</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                `;
                this.appendAIMessage(html, "AI CONTROLLER // FILE SEARCH");
            } catch(jsonErr) {
                this.appendAIMessage(`No matching files found.`, "AI CONTROLLER // SEARCH RESULTS");
            }
        });
    }

    async showDiskSpace() {
        try {
            let disks = await window.si.fsSize();
            if (!disks || !Array.isArray(disks)) {
                return this.appendAIMessage("Could not read disk partitions.", "AI CONTROLLER // ERROR");
            }

            let rows = disks.map(d => {
                let totalGb = Math.round(d.size / (1024 * 1024 * 1024));
                let usedGb = Math.round(d.used / (1024 * 1024 * 1024));
                let freeGb = totalGb - usedGb;
                let pct = Math.round(d.use);
                return `
                    <tr>
                        <td><strong>${d.mount}</strong> (${d.type || 'NTFS'})</td>
                        <td>${totalGb} GB</td>
                        <td>${usedGb} GB (${pct}%)</td>
                        <td style="color:${freeGb < 10 ? '#ff5566' : '#00ff80'};">${freeGb} GB</td>
                    </tr>
                `;
            }).join("");

            let html = `
                <div><strong>STORAGE VOLUMES & CAPACITY</strong></div>
                <table class="ai_table">
                    <thead>
                        <tr>
                            <th>MOUNT</th>
                            <th>TOTAL</th>
                            <th>USED</th>
                            <th>AVAILABLE</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            `;
            this.appendAIMessage(html, "AI CONTROLLER // STORAGE");
        } catch(e) {
            this.appendAIMessage(`Storage query failed: ${window._escapeHtml(e.message)}`, "AI CONTROLLER // ERROR");
        }
    }

    async showSystemDiagnostics() {
        try {
            let [cpu, load, mem, osInfo, time] = await Promise.all([
                window.si.cpu(),
                window.si.currentLoad(),
                window.si.mem(),
                window.si.osInfo(),
                window.si.time()
            ]);

            let uptimeHours = Math.round(time.uptime / 3600);
            let totalRamGb = (mem.total / (1024 * 1024 * 1024)).toFixed(1);
            let usedRamGb = (mem.used / (1024 * 1024 * 1024)).toFixed(1);
            let ramPct = Math.round((mem.used / mem.total) * 100);
            let cpuAvg = Math.round(load.currentload);

            let html = `
                <div><strong>SYSTEM HEALTH & DIAGNOSTICS DASHBOARD</strong></div>
                <div class="ai_card">
                    <span class="ai_card_title">CORE HARDWARE METRICS</span>
                    <div style="font-size:1.2vh; line-height:1.6; color:#d0d8e0;">
                        • <strong>Processor:</strong> ${cpu.manufacturer} ${cpu.brand} (${cpu.cores} Cores @ ${cpu.speed} GHz)<br/>
                        • <strong>Current CPU Load:</strong> <span style="color:${cpuAvg > 75 ? '#ff4455' : '#00ff80'};">${cpuAvg}%</span><br/>
                        • <strong>Physical RAM:</strong> ${usedRamGb} GB / ${totalRamGb} GB (${ramPct}% Allocated)<br/>
                        • <strong>Host Platform:</strong> ${osInfo.distro} ${osInfo.release} (${osInfo.arch})<br/>
                        • <strong>System Uptime:</strong> ${uptimeHours} Hours (${Math.round(time.uptime / 60)} minutes)<br/>
                        • <strong>Hostname:</strong> ${os.hostname()}
                    </div>
                </div>
            `;
            this.appendAIMessage(html, "AI CONTROLLER // DIAGNOSTICS");
        } catch(e) {
            this.appendAIMessage(`Diagnostics query failed: ${window._escapeHtml(e.message)}`, "AI CONTROLLER // ERROR");
        }
    }

    async showNetworkInfo() {
        try {
            let ifaces = await window.si.networkInterfaces();
            let netstat = window.mods && window.mods.netstat ? window.mods.netstat : null;

            let ifaceRows = ifaces.filter(i => i.ip4 && i.ip4 !== "127.0.0.1").map(i => `
                <tr>
                    <td><strong>${i.iface}</strong></td>
                    <td>${i.ip4}</td>
                    <td>${i.mac || '--'}</td>
                    <td>${i.operstate || 'UP'}</td>
                </tr>
            `).join("");

            let html = `
                <div><strong>NETWORK CONFIGURATION & CONNECTIVITY</strong></div>
                <table class="ai_table">
                    <thead>
                        <tr>
                            <th>INTERFACE</th>
                            <th>IPv4 ADDRESS</th>
                            <th>MAC ADDRESS</th>
                            <th>STATE</th>
                        </tr>
                    </thead>
                    <tbody>${ifaceRows || '<tr><td colspan="4">No active external interfaces</td></tr>'}</tbody>
                </table>
            `;
            this.appendAIMessage(html, "AI CONTROLLER // NETWORK");
        } catch(e) {
            this.appendAIMessage(`Network query failed: ${window._escapeHtml(e.message)}`, "AI CONTROLLER // ERROR");
        }
    }

    runPing(target) {
        this.appendAIMessage(`<i>Pinging ${window._escapeHtml(target)} (4 packets)...</i>`, "AI CONTROLLER // PING");

        exec(`ping -n 4 ${target}`, (err, stdout, stderr) => {
            let content = stdout || stderr || err.message;
            let html = `
                <div><strong>PING RESULTS FOR: ${window._escapeHtml(target)}</strong></div>
                <div class="ai_code_block">${window._escapeHtml(content.trim())}</div>
            `;
            this.appendAIMessage(html, "AI CONTROLLER // PING RESPONSE");
        });
    }

    lockWorkstation() {
        exec("rundll32.exe user32.dll,LockWorkStation", err => {
            if (err) {
                return this.appendAIMessage(`Failed to lock workstation: ${window._escapeHtml(err.message)}`, "AI CONTROLLER // ERROR");
            }
            this.appendAIMessage("✓ Windows Workstation locked successfully.", "AI CONTROLLER // SESSION LOCKED");
        });
    }

    handlePowerAction(action) {
        let title = action.toUpperCase();
        let cmd = action === "restart" ? "shutdown /r /t 5" : action === "shutdown" ? "shutdown /s /t 5" : "rundll32.exe powrprof.dll,SetSuspendState 0,1,0";

        let html = `
            <div><strong>POWER CONTROLLER: ${title}</strong></div>
            <div style="margin: 0.5vh 0; color: #ffaa55;">
                Are you sure you want to <strong>${title}</strong> the host machine?
            </div>
            <button class="ai_btn danger" onclick="exec('${cmd}'); window.aiController.appendAIMessage('Executing power operation: ${title}...', 'AI CONTROLLER // POWER');">CONFIRM ${title}</button>
        `;
        this.appendAIMessage(html, "AI CONTROLLER // CONFIRMATION");
    }

    listThemes() {
        try {
            const themesDir = path.join(require("@electron/remote").app.getPath("userData"), "themes");
            let files = fs.readdirSync(themesDir).filter(f => f.endsWith(".json"));

            let buttons = files.map(f => {
                let name = f.replace(".json", "");
                return `<button class="ai_btn" style="margin:0.2vh 0.2vw;" onclick="window.themeChanger('${name}')">${name.toUpperCase()}</button>`;
            }).join("");

            let html = `
                <div><strong>AVAILABLE EDEX-UI THEMES</strong></div>
                <div style="margin-top: 0.5vh;">${buttons}</div>
            `;
            this.appendAIMessage(html, "AI CONTROLLER // THEMES");
        } catch(e) {
            this.appendAIMessage(`Failed to load themes: ${window._escapeHtml(e.message)}`, "AI CONTROLLER // ERROR");
        }
    }

    setTheme(name) {
        window.themeChanger(name.toLowerCase());
        this.appendAIMessage(`Applying theme: <strong>${window._escapeHtml(name)}</strong>...`, "AI CONTROLLER // THEME");
    }

    setKeyboard(layout) {
        if (typeof window.remakeKeyboard === "function") {
            window.remakeKeyboard(layout.toLowerCase());
            this.appendAIMessage(`Applied keyboard layout: <strong>${window._escapeHtml(layout)}</strong>`, "AI CONTROLLER // KEYBOARD");
        }
    }

    toggleAudio() {
        window.settings.audio = !window.settings.audio;
        let state = window.settings.audio ? "ENABLED" : "MUTED";
        this.appendAIMessage(`eDEX-UI Audio FX: <strong>${state}</strong>`, "AI CONTROLLER // AUDIO");
    }

    browseUrl(query) {
        if (typeof window.focusBrowserTab === "function") {
            window.focusBrowserTab();
            let urlInput = document.getElementById("browser_url_input");
            let webview = document.getElementById("edex_browser_webview");
            if (urlInput && webview) {
                let targetUrl = query;
                if (/^https?:\/\//i.test(query)) {
                    targetUrl = query;
                } else if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(\/.*)?$/.test(query) && !query.includes(" ")) {
                    targetUrl = "https://" + query;
                } else {
                    targetUrl = "https://duckduckgo.com/?q=" + encodeURIComponent(query);
                }
                urlInput.value = targetUrl;
                webview.loadURL(targetUrl);
            }
        }
    }

    executeShell(command) {
        this.appendAIMessage(`<i>Executing: <code>${window._escapeHtml(command)}</code>...</i>`, "AI CONTROLLER // EXECUTION");

        exec(command, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
            let output = stdout || stderr || (err ? err.message : "(Completed with no output)");
            let html = `
                <div><strong>OUTPUT // EXIT CODE: ${err ? err.code || 1 : 0}</strong></div>
                <div class="ai_code_block">${window._escapeHtml(output.trim())}</div>
            `;
            this.appendAIMessage(html, "AI CONTROLLER // SHELL RESULT");
        });
    }
}

    window.AIController = AIController;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = { AIController };
    }
})();

class CanvasGlobe {
    constructor(width, height, options) {
        this.domElement = document.createElement("canvas");
        this.domElement.width = width || 320;
        this.domElement.height = height || 320;
        this.ctx = this.domElement.getContext("2d");
        this.options = options || {};
        this.tiles = options.tiles || [];
        this.pins = [];
        this.markers = [];
        this.constellations = [];
        this.rot = 0;
        this.tilt = 0.22; // ~12.6 degrees axial tilt
        this.pulse = 0;

        // Sample tiles (every 2nd tile from grid.json) for smooth 60fps vector rendering
        this.activeTiles = [];
        if (Array.isArray(this.tiles)) {
            for (let i = 0; i < this.tiles.length; i += 2) {
                let t = this.tiles[i];
                if (t && typeof t.lat === "number" && typeof t.lon === "number") {
                    this.activeTiles.push({
                        lat: t.lat,
                        lon: t.lon,
                        radLat: t.lat * (Math.PI / 180),
                        radLon: t.lon * (Math.PI / 180)
                    });
                }
            }
        }
    }

    init(bgColor, callback) {
        if (typeof callback === "function") callback();
    }

    addPin(lat, lon, text, alt) {
        let pin = {
            lat: Number(lat),
            lon: Number(lon),
            text: text || "",
            alt: alt || 1.15,
            radLat: Number(lat) * (Math.PI / 180),
            radLon: Number(lon) * (Math.PI / 180),
            remove: () => {
                let idx = this.pins.indexOf(pin);
                if (idx !== -1) this.pins.splice(idx, 1);
            }
        };
        this.pins.push(pin);
        return pin;
    }

    addMarker(lat, lon, text, isConnected, alt) {
        let marker = {
            lat: Number(lat),
            lon: Number(lon),
            text: text || "",
            isConnected: !!isConnected,
            alt: alt || 1.0,
            radLat: Number(lat) * (Math.PI / 180),
            radLon: Number(lon) * (Math.PI / 180),
            remove: () => {
                let idx = this.markers.indexOf(marker);
                if (idx !== -1) this.markers.splice(idx, 1);
            }
        };
        this.markers.push(marker);
        return marker;
    }

    addConstellation(constellation) {
        if (Array.isArray(constellation)) {
            this.constellations = constellation.slice();
        }
    }

    setSize(w, h) {
        if (w > 0 && h > 0) {
            this.domElement.width = w;
            this.domElement.height = h;
        }
    }

    tick() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const w = this.domElement.width;
        const h = this.domElement.height;
        ctx.clearRect(0, 0, w, h);

        this.rot += 0.007;
        this.pulse = (this.pulse + 0.06) % (Math.PI * 2);

        const cx = w / 2;
        const cy = h / 2;
        const R = Math.min(cx, cy) * 0.84;

        let r = (window.theme && window.theme.r) || 0;
        let g = (window.theme && window.theme.g) || 255;
        let b = (window.theme && window.theme.b) || 200;

        const cosTilt = Math.cos(this.tilt);
        const sinTilt = Math.sin(this.tilt);

        const project = (radLat, radLon, radius = R) => {
            let theta = radLon + this.rot;
            let cosPhi = Math.cos(radLat);
            let sinPhi = Math.sin(radLat);

            let x0 = radius * cosPhi * Math.sin(theta);
            let y0 = -radius * sinPhi;
            let z0 = radius * cosPhi * Math.cos(theta);

            let y1 = y0 * cosTilt - z0 * sinTilt;
            let z1 = y0 * sinTilt + z0 * cosTilt;

            return {
                x: cx + x0,
                y: cy + y1,
                z: z1,
                depth: z1 / radius
            };
        };

        // 1. Outer atmosphere glow
        let grad = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.06);
        grad.addColorStop(0, "rgba(" + r + "," + g + "," + b + ", 0.02)");
        grad.addColorStop(0.85, "rgba(" + r + "," + g + "," + b + ", 0.14)");
        grad.addColorStop(1, "rgba(" + r + "," + g + "," + b + ", 0.0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.06, 0, Math.PI * 2);
        ctx.fill();

        // 2. Horizon sphere boundary
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(" + r + "," + g + "," + b + ", 0.45)";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 3. Latitude wireframe lines
        const lats = [-60, -30, 0, 30, 60];
        for (let l = 0; l < lats.length; l++) {
            let radLat = lats[l] * (Math.PI / 180);
            let isEquator = (lats[l] === 0);
            ctx.beginPath();
            let started = false;
            for (let deg = 0; deg <= 360; deg += 10) {
                let radLon = deg * (Math.PI / 180);
                let p = project(radLat, radLon);
                if (p.z > -2) {
                    if (!started) {
                        ctx.moveTo(p.x, p.y);
                        started = true;
                    } else {
                        ctx.lineTo(p.x, p.y);
                    }
                } else {
                    started = false;
                }
            }
            ctx.strokeStyle = isEquator
                ? "rgba(" + r + "," + g + "," + b + ", 0.3)"
                : "rgba(" + r + "," + g + "," + b + ", 0.12)";
            ctx.lineWidth = isEquator ? 1.0 : 0.7;
            ctx.stroke();
        }

        // Longitudes wireframe
        for (let lonDeg = 0; lonDeg < 360; lonDeg += 45) {
            let radLon = lonDeg * (Math.PI / 180);
            ctx.beginPath();
            let started = false;
            for (let latDeg = -85; latDeg <= 85; latDeg += 8) {
                let radLat = latDeg * (Math.PI / 180);
                let p = project(radLat, radLon);
                if (p.z > 0) {
                    if (!started) {
                        ctx.moveTo(p.x, p.y);
                        started = true;
                    } else {
                        ctx.lineTo(p.x, p.y);
                    }
                } else {
                    started = false;
                }
            }
            ctx.strokeStyle = "rgba(" + r + "," + g + "," + b + ", 0.12)";
            ctx.lineWidth = 0.7;
            ctx.stroke();
        }

        // 4. Continent landmass vector dots
        for (let i = 0; i < this.activeTiles.length; i++) {
            let t = this.activeTiles[i];
            let p = project(t.radLat, t.radLon);
            if (p.z > 0) {
                let alpha = (p.depth * 0.75 + 0.2).toFixed(2);
                let size = p.depth > 0.6 ? 2.2 : (p.depth > 0.2 ? 1.6 : 1.1);
                ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
                ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
            }
        }

        // 5. Constellations / Satellites
        for (let i = 0; i < this.constellations.length; i++) {
            let sat = this.constellations[i];
            let radLat = (sat.lat || 0) * (Math.PI / 180);
            let radLon = ((sat.lon || 0) + this.rot * 12) * (Math.PI / 180);
            let altRadius = R * (sat.altitude || 1.35);
            let p = project(radLat, radLon, altRadius);
            if (p.z > -altRadius * 0.2) {
                ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
                ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
                ctx.strokeStyle = "rgba(" + r + "," + g + "," + b + ", 0.4)";
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // 6. Network Connection Markers & Arcs
        let primaryPin = null;
        if (this.pins.length > 0) {
            primaryPin = this.pins[0];
        }

        for (let i = 0; i < this.pins.length; i++) {
            let pin = this.pins[i];
            let p = project(pin.radLat, pin.radLon, R * (pin.alt || 1.12));
            if (p.z > 0) {
                // Pulsing target beacon
                let pulseSize = 3 + Math.sin(this.pulse) * 2.5;
                ctx.strokeStyle = "rgba(" + r + "," + g + "," + b + ", 0.95)";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, pulseSize, 0, Math.PI * 2);
                ctx.stroke();

                // Holographic beacon mast
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x, p.y - 14);
                ctx.strokeStyle = "rgba(" + r + "," + g + "," + b + ", 0.75)";
                ctx.stroke();

                ctx.fillStyle = "rgba(" + r + "," + g + "," + b + ", 1.0)";
                ctx.fillRect(p.x - 2, p.y - 16, 4, 3);
            }
        }

        for (let i = 0; i < this.markers.length; i++) {
            let marker = this.markers[i];
            let p = project(marker.radLat, marker.radLon, R * 1.05);
            if (p.z > 0) {
                ctx.fillStyle = marker.isConnected ? "#00ff88" : "rgba(255, 80, 80, 0.85)";
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
                ctx.fill();

                if (primaryPin) {
                    let p0 = project(primaryPin.radLat, primaryPin.radLon, R * 1.05);
                    if (p0.z > -10 && p.z > -10) {
                        let midX = (p0.x + p.x) / 2;
                        let midY = (p0.y + p.y) / 2 - 22;
                        ctx.beginPath();
                        ctx.moveTo(p0.x, p0.y);
                        ctx.quadraticCurveTo(midX, midY, p.x, p.y);
                        ctx.strokeStyle = "rgba(" + r + "," + g + "," + b + ", 0.4)";
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }
            }
        }
    }
}

class LocationGlobe {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        const path = require("path");

        this._geodata = require(path.join(__dirname, "assets/misc/grid.json"));
        try {
            require(path.join(__dirname, "assets/vendor/encom-globe.js"));
        } catch(e) {}
        this.ENCOM = window.ENCOM;

        // Create DOM
        this.parent = document.getElementById(parentId);
        this.parent.innerHTML += `<div id="mod_globe">
            <div id="mod_globe_innercontainer">
                <h1>WORLD VIEW<i>GLOBAL NETWORK MAP</i></h1>
                <h2>ENDPOINT LAT/LON<i class="mod_globe_headerInfo">SCANNING...</i></h2>
                <div id="mod_globe_canvas_placeholder"></div>
                <h3>OFFLINE</h3>
            </div>
        </div>`;

        this.lastgeo = {
            latitude: 28.6139,
            longitude: 77.2090
        };
        this.conns = [];

        setTimeout(() => {
            let container = document.getElementById("mod_globe_innercontainer");
            let placeholder = document.getElementById("mod_globe_canvas_placeholder");
            if (!container || !placeholder) return;

            let globeWidth = placeholder.offsetWidth || 300;
            let globeHeight = placeholder.offsetHeight || 300;

            // Check if WebGL is available
            let webglAvailable = false;
            try {
                let testCanvas = document.createElement("canvas");
                webglAvailable = !!(window.WebGLRenderingContext && (testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl")));
            } catch(e) {
                webglAvailable = false;
            }

            let useEncom = false;
            if (webglAvailable && this.ENCOM && typeof this.ENCOM.Globe === "function") {
                try {
                    this.globe = new this.ENCOM.Globe(globeWidth, globeHeight, {
                        font: (window.theme && window.theme.cssvars && window.theme.cssvars.font_main) || "monospace",
                        data: [],
                        tiles: this._geodata.tiles,
                        baseColor: (window.theme && window.theme.globe && window.theme.globe.base) || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                        markerColor: (window.theme && window.theme.globe && window.theme.globe.marker) || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                        pinColor: (window.theme && window.theme.globe && window.theme.globe.pin) || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                        satelliteColor: (window.theme && window.theme.globe && window.theme.globe.satellite) || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                        scale: 1.1,
                        viewAngle: 0.630,
                        dayLength: 1000 * 45,
                        introLinesDuration: 2000,
                        introLinesColor: (window.theme && window.theme.globe && window.theme.globe.marker) || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                        maxPins: 300,
                        maxMarkers: 100
                    });
                    useEncom = true;
                } catch(encomErr) {
                    console.warn("Encom 3D Globe init failed, using Cyberpunk Canvas Globe:", encomErr);
                    useEncom = false;
                }
            }

            // Fallback to CanvasGlobe if WebGL is unavailable or failed
            if (!useEncom) {
                this.globe = new CanvasGlobe(globeWidth, globeHeight, {
                    tiles: this._geodata.tiles
                });
            }

            // Place Globe DOM
            if (placeholder.parentNode) {
                placeholder.remove();
            }
            container.append(this.globe.domElement);

            // Init animations
            this._animate = () => {
                if (window.mods && window.mods.globe && window.mods.globe.globe) {
                    window.mods.globe.globe.tick();
                }
                if (window.mods && window.mods.globe && window.mods.globe._animate) {
                    setTimeout(() => {
                        try {
                            requestAnimationFrame(window.mods.globe._animate);
                        } catch(e) {}
                    }, 1000 / 30);
                }
            };

            this.globe.init(window.theme ? window.theme.colors.light_black : "#000", () => {
                this._animate();
                if (window.audioManager && window.audioManager.scan) {
                    window.audioManager.scan.play();
                }
            });

            // Resize handler
            this.resizeHandler = () => {
                if (!window.mods || !window.mods.globe || !window.mods.globe.globe) return;
                let canvas = document.querySelector("div#mod_globe canvas");
                if (!canvas) return;
                let w = canvas.offsetWidth || 300;
                let h = canvas.offsetHeight || 300;
                if (window.mods.globe.globe.camera && window.mods.globe.globe.renderer) {
                    window.mods.globe.globe.camera.aspect = w / h;
                    window.mods.globe.globe.camera.updateProjectionMatrix();
                    window.mods.globe.globe.renderer.setSize(w, h);
                } else if (typeof window.mods.globe.globe.setSize === "function") {
                    window.mods.globe.globe.setSize(w, h);
                }
            };
            window.addEventListener("resize", this.resizeHandler);

            // Connections management
            this.conns = [];
            this.addConn = ip => {
                if (!this.globe || typeof this.globe.addPin !== "function") return;
                let data = null;
                try {
                    data = window.mods.netstat.geoLookup.get(ip);
                } catch(e) {}
                let geo = (data !== null && data !== undefined ? (data.location || {}) : {});
                if (geo && geo.latitude && geo.longitude) {
                    const lat = Number(geo.latitude);
                    const lon = Number(geo.longitude);
                    this.conns.push({
                        ip,
                        pin: this.globe.addPin(lat, lon, "", 1.2),
                    });
                }
            };
            this.removeConn = ip => {
                let index = this.conns.findIndex(x => x.ip === ip);
                if (index !== -1 && this.conns[index]) {
                    if (this.conns[index].pin && typeof this.conns[index].pin.remove === "function") {
                        this.conns[index].pin.remove();
                    }
                    this.conns.splice(index, 1);
                }
            };

            // Add satellites
            let constellation = [];
            for (let i = 0; i < 2; i++) {
                for (let j = 0; j < 3; j++) {
                    constellation.push({
                        lat: 50 * i - 30 + 15 * Math.random(),
                        lon: 120 * j - 120 + 30 * i,
                        altitude: Math.random() * (1.7 - 1.3) + 1.3
                    });
                }
            }
            if (typeof this.globe.addConstellation === "function") {
                this.globe.addConstellation(constellation);
            }

            // Immediately place initial default location pin
            if (this.globe && typeof this.globe.addPin === "function") {
                this._locPin = this.globe.addPin(this.lastgeo.latitude, this.lastgeo.longitude, "", 1.2);
                this._locMarker = this.globe.addMarker(this.lastgeo.latitude, this.lastgeo.longitude, "", false, 1.2);
                let headerInfo = document.querySelector("i.mod_globe_headerInfo");
                if (headerInfo) headerInfo.innerText = `${this.lastgeo.latitude.toFixed(4)}, ${this.lastgeo.longitude.toFixed(4)}`;
            }
        }, 1200);

        // Init updaters
        setTimeout(() => {
            this.updateLoc();
            this.locUpdater = setInterval(() => {
                this.updateLoc();
            }, 1500);

            this.updateConns();
            this.connsUpdater = setInterval(() => {
                this.updateConns();
            }, 3000);
        }, 3000);
    }

    addRandomConnectedMarkers() {
        if (!this.globe || typeof this.globe.addMarker !== "function") return;
        const randomLat = this.getRandomInRange(40, 90, 3);
        const randomLong = this.getRandomInRange(-180, 0, 3);
        this.globe.addMarker(randomLat, randomLong, '');
        this.globe.addMarker(randomLat - 20, randomLong + 150, '', true);
    }

    addTemporaryConnectedMarker(ip) {
        if (!window.mods.netstat || !window.mods.netstat.geoLookup || typeof window.mods.netstat.geoLookup.get !== "function") return;
        let data = null;
        try {
            data = window.mods.netstat.geoLookup.get(ip);
        } catch(e) {}
        let geo = (data !== null && data !== undefined ? (data.location || {}) : {});
        if (geo.latitude && geo.longitude && window.mods.globe && window.mods.globe.globe) {
            const lat = Number(geo.latitude);
            const lon = Number(geo.longitude);

            window.mods.globe.conns.push({
                ip,
                pin: window.mods.globe.globe.addPin(lat, lon, "", 1.2)
            });
            let mark = window.mods.globe.globe.addMarker(lat, lon, '', true);
            setTimeout(() => {
                if (mark && typeof mark.remove === "function") mark.remove();
            }, 3000);
        }
    }

    removeMarkers() {
        if (!this.globe || !this.globe.markers) return;
        this.globe.markers.forEach(marker => { if (marker && marker.remove) marker.remove(); });
        this.globe.markers = [];
    }

    removePins() {
        if (!this.globe || !this.globe.pins) return;
        this.globe.pins.forEach(pin => {
            if (pin && pin.remove) pin.remove();
        });
        this.globe.pins = [];
    }

    getRandomInRange(from, to, fixed) {
        return (Math.random() * (to - from) + from).toFixed(fixed) * 1;
    }

    updateLoc() {
        if (!window.mods || !window.mods.netstat) return;

        let globeEl = document.querySelector("div#mod_globe");
        let headerInfo = document.querySelector("i.mod_globe_headerInfo");

        if (window.mods.netstat.offline) {
            if (globeEl) globeEl.setAttribute("class", "offline");
            if (headerInfo) headerInfo.innerText = `${this.lastgeo.latitude.toFixed(4)}, ${this.lastgeo.longitude.toFixed(4)} (LOCAL)`;
        } else {
            this.updateConOnlineConnection().then(() => {
                if (globeEl) globeEl.setAttribute("class", "");
            }).catch(() => {
                if (headerInfo) headerInfo.innerText = `${this.lastgeo.latitude.toFixed(4)}, ${this.lastgeo.longitude.toFixed(4)}`;
            });
        }
    }

    async updateConOnlineConnection() {
        if (!window.mods.netstat || !window.mods.netstat.ipinfo || !window.mods.netstat.ipinfo.geo) return;
        let geo = window.mods.netstat.ipinfo.geo;
        if (typeof geo.latitude !== "number" || typeof geo.longitude !== "number") return;
        let newgeo = {
            latitude: Math.round(geo.latitude * 10000) / 10000,
            longitude: Math.round(geo.longitude * 10000) / 10000
        };

        if (newgeo.latitude !== this.lastgeo.latitude || newgeo.longitude !== this.lastgeo.longitude) {
            let headerInfo = document.querySelector("i.mod_globe_headerInfo");
            if (headerInfo) headerInfo.innerText = `${newgeo.latitude}, ${newgeo.longitude}`;
            this.removePins();
            this.removeMarkers();
            this.conns = [];

            if (this.globe && typeof this.globe.addPin === "function") {
                this._locPin = this.globe.addPin(newgeo.latitude, newgeo.longitude, "", 1.2);
                this._locMarker = this.globe.addMarker(newgeo.latitude, newgeo.longitude, "", false, 1.2);
            }
        }

        this.lastgeo = newgeo;
        let globeEl = document.querySelector("div#mod_globe");
        if (globeEl) globeEl.setAttribute("class", "");
    }

    updateConns() {
        if (!window.mods.globe || !window.mods.globe.globe || !window.mods.netstat || window.mods.netstat.offline) return false;
        if (!window.si || typeof window.si.networkConnections !== "function") return false;
        window.si.networkConnections().then(conns => {
            if (!conns || !Array.isArray(conns)) return;
            let newconns = [];
            conns.forEach(conn => {
                let ip = conn.peeraddress;
                let state = conn.state;
                if (state === "ESTABLISHED" && ip && ip !== "0.0.0.0" && ip !== "127.0.0.1" && ip !== "::") {
                    newconns.push(ip);
                }
            });

            this.conns.forEach(conn => {
                if (newconns.indexOf(conn.ip) !== -1) {
                    newconns.splice(newconns.indexOf(conn.ip), 1);
                } else {
                    this.removeConn(conn.ip);
                }
            });

            newconns.forEach(ip => {
                this.addConn(ip);
            });
        }).catch(() => {});
    }
}

module.exports = {
    LocationGlobe
};

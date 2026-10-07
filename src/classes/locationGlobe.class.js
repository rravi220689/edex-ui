class LocationGlobe {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        const path = require("path");

        this._geodata = require(path.join(__dirname, "assets/misc/grid.json"));
        require(path.join(__dirname, "assets/vendor/encom-globe.js"));
        this.ENCOM = window.ENCOM;

        // Create DOM and include lib
        this.parent = document.getElementById(parentId);
        this.parent.innerHTML += `<div id="mod_globe">
            <div id="mod_globe_innercontainer">
                <h1>WORLD VIEW<i>GLOBAL NETWORK MAP</i></h1>
                <h2>ENDPOINT LAT/LON<i class="mod_globe_headerInfo">0.0000, 0.0000</i></h2>
                <div id="mod_globe_canvas_placeholder"></div>
                <h3>OFFLINE</h3>
            </div>
        </div>`;

        this.lastgeo = {};
        this.conns = [];


        setTimeout(() => {
            let container = document.getElementById("mod_globe_innercontainer");
            let placeholder = document.getElementById("mod_globe_canvas_placeholder");
            if (!container || !placeholder) return;

            // Check if WebGL is available
            let webglAvailable = false;
            try {
                let testCanvas = document.createElement("canvas");
                webglAvailable = !!(window.WebGLRenderingContext && (testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl")));
            } catch(e) {
                webglAvailable = false;
            }

            if (!webglAvailable) {
                placeholder.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(var(--color_r),var(--color_g),var(--color_b),0.7);font-family:var(--font_main);font-size:12px;text-align:center;">WEBGL UNAVAILABLE<br/>[GPU ACCEL DISABLED]</div>`;
                return;
            }

            try {
                // Create Globe
                this.globe = new this.ENCOM.Globe(placeholder.offsetWidth, placeholder.offsetHeight, {
                    font: window.theme.cssvars.font_main,
                    data: [],
                    tiles: this._geodata.tiles,
                    baseColor: window.theme.globe.base || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                    markerColor: window.theme.globe.marker || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                    pinColor: window.theme.globe.pin || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                    satelliteColor: window.theme.globe.satellite || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                    scale: 1.1,
                    viewAngle: 0.630,
                    dayLength: 1000 * 45,
                    introLinesDuration: 2000,
                    introLinesColor: window.theme.globe.marker || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                    maxPins: 300,
                    maxMarkers: 100
                });

                // Place Globe
                placeholder.remove();
                container.append(this.globe.domElement);

                // Init animations
                this._animate = () => {
                    if (window.mods.globe && window.mods.globe.globe) {
                        window.mods.globe.globe.tick();
                    }
                    if (window.mods.globe && window.mods.globe._animate) {
                        setTimeout(() => {
                            try {
                                requestAnimationFrame(window.mods.globe._animate);
                            } catch(e) {
                                console.warn(e);
                            }
                        }, 1000 / 30);
                    }
                };
                this.globe.init(window.theme.colors.light_black, () => {
                    this._animate();
                    window.audioManager.scan.play();
                });

                // resize handler
                this.resizeHandler = () => {
                    if (!window.mods.globe || !window.mods.globe.globe) return;
                    let canvas = document.querySelector("div#mod_globe canvas");
                    if (canvas && window.mods.globe.globe.camera && window.mods.globe.globe.renderer) {
                        window.mods.globe.globe.camera.aspect = canvas.offsetWidth / canvas.offsetHeight;
                        window.mods.globe.globe.camera.updateProjectionMatrix();
                        window.mods.globe.globe.renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
                    }
                };
                window.addEventListener("resize", this.resizeHandler);

                // Connections
                this.conns = [];
                this.addConn = ip => {
                    if (!this.globe || typeof this.globe.addPin !== "function") return;
                    let data = null;
                    try {
                        data = window.mods.netstat.geoLookup.get(ip);
                    } catch {
                        // do nothing
                    }
                    let geo = (data !== null ? data.location : {});
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

                // Add random satellites
                let constellation = [];
                for(var i = 0; i< 2; i++){
                    for(var j = 0; j< 3; j++){
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
            } catch(e) {
                console.warn("LocationGlobe initialization failed:", e);
                if (placeholder) {
                    placeholder.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(var(--color_r),var(--color_g),var(--color_b),0.7);font-family:var(--font_main);font-size:12px;text-align:center;">GLOBE OFFLINE</div>`;
                }
            }
        }, 2000);

        // Init updaters when intro animation is done
        setTimeout(() => {
            this.updateLoc();
            this.locUpdater = setInterval(() => {
                this.updateLoc();
            }, 1000);

            this.updateConns();
            this.connsUpdater = setInterval(() => {
                this.updateConns();
            }, 3000);
        }, 4000);
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
        if (window.mods.netstat.offline) {
            document.querySelector("div#mod_globe").setAttribute("class", "offline");
            document.querySelector("i.mod_globe_headerInfo").innerText = "(OFFLINE)";

            this.removePins();
            this.removeMarkers();
            this.conns = [];
            this.lastgeo = {
                latitude: 0,
                longitude: 0
            };
        } else {
            this.updateConOnlineConnection().then(() => {
                document.querySelector("div#mod_globe").setAttribute("class", "");
            }).catch(() => {
                document.querySelector("i.mod_globe_headerInfo").innerText = "UNKNOWN";
            })
        }
    }
    async updateConOnlineConnection() {
        if (!window.mods.netstat || !window.mods.netstat.ipinfo || !window.mods.netstat.ipinfo.geo) return;
        let geo = window.mods.netstat.ipinfo.geo;
        if (typeof geo.latitude !== "number" || typeof geo.longitude !== "number") return;
        let newgeo = {
            latitude: Math.round(geo.latitude*10000)/10000,
            longitude: Math.round(geo.longitude*10000)/10000
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

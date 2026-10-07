class RAMwatcher {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        // Create DOM
        this.parent = document.getElementById(parentId);
        let modExtContainer = document.createElement("div");
        let ramwatcherDOM = `<div id="mod_ramwatcher_inner">
                <h1>MEMORY<i id="mod_ramwatcher_info"></i></h1>
                <div id="mod_ramwatcher_pointmap">`;

        for (var i = 0; i < 440; i++) {
            ramwatcherDOM += `<div class="mod_ramwatcher_point free"></div>`;
        }

        ramwatcherDOM += `</div>
                <div id="mod_ramwatcher_swapcontainer">
                    <h1>SWAP</h1>
                    <progress id="mod_ramwatcher_swapbar" max="100" value="0"></progress>
                    <h3 id="mod_ramwatcher_swaptext">0.0 GiB</h3>
                </div>
        </div>`;

        modExtContainer.innerHTML = ramwatcherDOM;
        modExtContainer.setAttribute("id", "mod_ramwatcher");
        this.parent.append(modExtContainer);

        this.points = Array.from(document.querySelectorAll("div.mod_ramwatcher_point"));
        this.shuffleArray(this.points);

        // Init updaters
        this.currentlyUpdating = false;
        this.updateInfo();
        this.infoUpdater = setInterval(() => {
            this.updateInfo();
        }, 1500);
    }
    updateInfo() {
        if (this.currentlyUpdating) return;
        this.currentlyUpdating = true;
        window.si.mem().then(data => {
            if (!data || !data.total) return;

            let activeBytes = data.active || data.used || (data.total - data.free) || 0;
            let freeBytes = data.free || 0;
            let availBytes = data.available || freeBytes;

            // Convert the data for the 440-points grid
            let active = Math.max(0, Math.min(440, Math.round((440 * activeBytes) / data.total)));
            let available = Math.max(0, Math.min(440 - active, Math.round((440 * Math.max(0, availBytes - freeBytes)) / data.total)));

            // Update grid
            this.points.slice(0, active).forEach(domPoint => {
                if (domPoint && domPoint.attributes && domPoint.attributes.class && domPoint.attributes.class.value !== "mod_ramwatcher_point active") {
                    domPoint.setAttribute("class", "mod_ramwatcher_point active");
                }
            });
            this.points.slice(active, active+available).forEach(domPoint => {
                if (domPoint && domPoint.attributes && domPoint.attributes.class && domPoint.attributes.class.value !== "mod_ramwatcher_point available") {
                    domPoint.setAttribute("class", "mod_ramwatcher_point available");
                }
            });
            this.points.slice(active+available, this.points.length).forEach(domPoint => {
                if (domPoint && domPoint.attributes && domPoint.attributes.class && domPoint.attributes.class.value !== "mod_ramwatcher_point free") {
                    domPoint.setAttribute("class", "mod_ramwatcher_point free");
                }
            });

            // Update info text
            let totalGiB = Math.round((data.total/1073742000)*10)/10; // 1073742000 bytes = 1 Gibibyte (GiB), the *10 is to round to .1 decimal
            let usedGiB = Math.round((activeBytes/1073742000)*10)/10;
            const infoEl = document.getElementById("mod_ramwatcher_info");
            if (infoEl) infoEl.innerText = `USING ${usedGiB} OUT OF ${totalGiB} GiB`;

            // Update swap indicator
            let usedSwap = Math.round((100*(data.swapused || 0))/(data.swaptotal || 1));
            const barEl = document.getElementById("mod_ramwatcher_swapbar");
            if (barEl) barEl.value = usedSwap || 0;

            let usedSwapGiB = Math.round(((data.swapused || 0)/1073742000)*10)/10;
            const swapEl = document.getElementById("mod_ramwatcher_swaptext");
            if (swapEl) swapEl.innerText = `${usedSwapGiB} GiB`;

            this.currentlyUpdating = false;
        }).catch(err => {
            this.currentlyUpdating = false;
        });
    }
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

module.exports = {
    RAMwatcher
};

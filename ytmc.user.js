// ==UserScript==
// @name    youtube-manifest-cache
// @match   https://youtube.com/*
// @match   https://*.youtube.com/*
// @version 1.0
// @grant   GM_addStyle
// ==/UserScript==

/*
https://www.youtube.com/watch?v=zdUJ4bIiRs0 mengen
https://www.youtube.com/watch?v=VHwQp1XtWLA priv
https://www.youtube.com/watch?v=02vRF2yi8VY priv
https://www.youtube.com/watch?v=0nZxBDK_UII gone
*/

function log(txt) {
    console.log(`[ytmc] ${new Date().toISOString().split('T')[1]} ${txt}`);
}

var scr = document.createElement('script');
scr.textContent = '(' + grunnur.toString() + ')();';
(document.head || document.getElementsByTagName('head')[0]).appendChild(scr);

function grunnur() {
    var QS = document.querySelector.bind(document),
        QSA = document.querySelectorAll.bind(document),
        mknod = document.createElement.bind(document),
        ui = mknod('div'),
        ui_nick = null,
        ui_msg = null,
        ui_dl = null,
        last_url = null;

    function log(txt) {
        console.log(`[ytmc] ${new Date().toISOString().split('T')[1]} ${txt}`);
    }

    function get_id() {
        return /.*[?&]v=([a-zA-Z0-9_-]{11})/.exec(window.location.href)[1];
    }

    function load_ui() {
        if (QS('#ytmc_ui'))
            return;

        ui.innerHTML = 'ytmc username: <input type="text" id="ytmc_nick" title="will be your identifier on the index website" /> <button id="ytmc_dl">download json</button> <span id="ytmc_msg">no playerdata found</span> <a href="#" id="ytmc_ee">.</a>';
        ui.setAttribute('id', 'ytmc_ui');
        try {
            var neigh = QS('ytd-watch-flexy #meta')
            neigh.parentNode.insertBefore(ui, neigh);

            ui_dl = QS('#ytmc_dl');
            ui_msg = QS('#ytmc_msg');
            ui_nick = QS('#ytmc_nick');

            ui_dl.onclick = download_pd;
            QS('#ytmc_ee').onclick = easter;
            freshen_ui();
        }
        catch (ex) { }
    }
    setInterval(load_ui, 1000);

    function freshen_ui() {
        try {
            var mf = get_cached_pd(get_id());
            ui_dl.style.display = mf ? '' : 'none';
            ui_msg.style.display = mf ? 'none' : '';
        } catch (ex) {
            log('freshen_ui failed, ' + ex);
        }
    }

    function easter(e) {
        e.preventDefault();
        var base = 'https://ocv.me/stuff/COOL-FREE-RINGTONES/',
            alts = ['inori-wow.mp3', 'n3310-sms-01.mp3', 'toasty.mp3', 'azumanga-op.m4a', 'bluethings-hey-v2.mp3', 'ge-maybe.m4a'],
            au = new Audio();
        au.src = base + alts[Math.floor(Math.random() * alts.length)];
        au.play();
    }

    function scrape_pd() {
        var pd = document.querySelector('ytd-watch-flexy');
        if (!pd || !pd.playerData)
            return log('no video found');

        pd = pd.playerData;
        var mu = pd.streamingData.dashManifestUrl || pd.streamingData.hlsManifestUrl;
        if (!mu || !mu.length)
            return log('no playerdata found');

        if (last_url == mu)
            return;

        var vid = pd.videoDetails.videoId,
            now = Math.floor(Date.now() / 1000);

        if (vid != get_id())
            return log(`vid ${vid} != get_id ${get_id()} ??`);

        clean_localstore(vid);
        localStorage.setItem(
            `ytmc_${now}_${vid}`,
            JSON.stringify(pd));

        log(`stored ${vid}`);
        freshen_ui();
        last_url = mu;
    }
    setInterval(scrape_pd, 10 * 1000);

    function get_cached_pd(vid) {
        for (var key in localStorage) {
            var m = /^ytmc_([0-9]+)_(.*)/.exec(key);
            if (!m)
                continue;

            if (m[2] == vid)
                return localStorage.getItem(key);
        }
    }

    function clean_localstore(rm_vid) {
        var rm = [], now = Math.floor(Date.now() / 1000);
        for (var key in localStorage) {
            var m = /^ytmc_([0-9]+)_(.*)/.exec(key);
            if (!m)
                continue;

            var t = m[1],
                vid = m[2],
                td = now - parseInt(t),
                expired = td - (60 * 60 * 6); // 6h

            if (expired > 0 || vid == rm_vid) {
                log(`removing ${vid} (expired ${expired} sec ago)`);
                rm.push(key);
            }
        }
        for (var key of rm)
            try {
                localStorage.removeItem(key);
            }
            catch (ex) { }
    }

    async function download_pd() {
        var pd = get_cached_pd(get_id());
        if (!pd)
            return alert('json lookup failed, userscript broke, try grabbing from localstore');

        pd = JSON.parse(pd);

        // modification of getURLs.js
        const VERSION = "1.5"
        const PRIORITY = {
            "VIDEO": [
                337, 315, 266, 138, // 2160p60
                313, 336, // 2160p
                308, // 1440p60
                271, 264, // 1440p
                335, 303, 299, // 1080p60
                248, 169, 137, // 1080p
                334, 302, 298, // 720p60
                247, 136 // 720p
            ],
            "AUDIO": [
                251, 141, 171, 140, 250, 249, 139
            ]
        };

        async function getYoutubeVideoInfo() {
            var thumbnailUrl,
                start_ts = '',
                vid_id = pd.videoDetails.videoId;

            try {
                thumbnailUrl = pd.microformat.playerMicroformatRenderer.thumbnail.thumbnails[0].url;
                start_ts = pd.microformat.playerMicroformatRenderer.liveBroadcastDetails.startTimestamp;
            }
            catch (ex) {
                thumbnailUrl = `https://img.youtube.com/vi/${vid_id}/maxresdefault.jpg`
            }

            return {
                title: pd.videoDetails.title,
                id: vid_id,
                channelName: pd.videoDetails.author,
                channelURL: "https://www.youtube.com/channel/" + pd.videoDetails.channelId,
                description: pd.videoDetails.shortDescription,
                thumbnail: await getImage(thumbnailUrl),
                thumbnailUrl,
                startTimestamp: start_ts
            };
        }

        function getImage(url) {
            var xhr = new XMLHttpRequest(),
                fb = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=";

            xhr.responseType = 'blob';
            return new Promise((resolve, reject) => {
                xhr.onload = function () {
                    var reader = new FileReader();
                    reader.onloadend = function () {
                        resolve(reader.result);
                    }
                    reader.readAsDataURL(xhr.response);
                };
                xhr.onreadystatechange = function () {
                    if (this.readyState == XMLHttpRequest.DONE && this.status >= 400)
                        resolve(fb);
                };
                xhr.onerror = function () {
                    resolve(fb);
                };
                xhr.open('GET', url);
                xhr.send();
            });
        }

        function download(data, filename, type) {
            var file = new Blob([data], { type: type });
            var a = document.createElement("a"), url = URL.createObjectURL(file);
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 0);
        }

        let best = {
            video: null,
            audio: null,
            metadata: await getYoutubeVideoInfo(),
            version: VERSION,
            createTime: new Date().toISOString()
        };

        var result = {};
        for (var af of pd.streamingData.adaptiveFormats)
            result[af.itag] = af.url;

        for (const itag of PRIORITY.VIDEO) {
            if (Object.keys(result).includes(itag.toString()) && result[itag.toString()].includes("noclen")) {
                best.video = {
                    [itag.toString()]: result[itag.toString()]
                };
                break;
            }
        }
        for (const itag of PRIORITY.AUDIO) {
            if (Object.keys(result).includes(itag.toString()) && result[itag.toString()].includes("noclen")) {
                best.audio = {
                    [itag.toString()]: result[itag.toString()]
                };
                break;
            }
        }
        download(JSON.stringify(best, null, 4), `${get_id()}.urls.json`, "application/json");
    }

    var s = mknod('style');
    s.innerHTML = `
        #ytmc_ui {
            padding: .5em 0;
            font-size: 1.3em;
        }
        #ytmc_nick {
            margin-right: 3em;
        }
        #ytmc_msg {
            color: #930;
            font-weight: bold;
        }
    `;
    document.head.appendChild(s);
    log('stage 2 ok');
}
log('stage 1 ok');

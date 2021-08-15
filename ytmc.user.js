// ==UserScript==
// @name    youtube-manifest-cache
// @match   https://youtube.com/*
// @match   https://*.youtube.com/*
// @exclude https://*/live_chat*
// @version 1.0
// @grant   GM_addStyle
// ==/UserScript==

function grunnur() {
    
    var ytmc_server = 'http://127.0.0.1:8000/';

    var QS = document.querySelector.bind(document),
        ui_div = document.createElement('div'),
        ui_nick = null,
        ui_msg = null,
        ui_tx = null,
        ui_dl = null,
        previous_manifest_url = null,
        previous_log_msg = null;

    function log(txt, err) {
        if (err && txt == previous_log_msg)
            return;
        
        previous_log_msg = txt;
        console.log(`[ytmc] ${new Date().toISOString().split('T')[1]} ${txt}`);
    }

    function get_id() {
        var m = /.*[?&]v=([a-zA-Z0-9_-]{11})/.exec(window.location.href)
        return m ? m[1] : null;
    }

    function load_ui() {
        if (QS('#ytmc_ui'))
            return;

        ui_div.innerHTML = `
            ytmc username: <input type="text" id="ytmc_nick"
                title="will be your identifier on the index website" />
            
            <button id="ytmc_dl">download json</button>
            <button id="ytmc_tx"
                title="tell the server that you have the json (the json itself is not uploaded)"
                >announce</button>

            <span id="ytmc_msg"></span>
            <a href="#" id="ytmc_ee">.</a>
        `;
        ui_div.setAttribute('id', 'ytmc_ui');
        try {
            var neigh = QS('ytd-watch-flexy #meta')
            neigh.parentNode.insertBefore(ui_div, neigh);

            ui_dl = QS('#ytmc_dl');
            ui_tx = QS('#ytmc_tx');
            ui_msg = QS('#ytmc_msg');
            ui_nick = QS('#ytmc_nick');

            ui_nick.value = localStorage.getItem('ytmc_nick') || '';
            ui_nick.oninput = namechange;
            ui_dl.onclick = download_pdata;
            ui_tx.onclick = send_to_server;
            ui_tx.style.display = 'none';
            
            QS('#ytmc_ee').onclick = easter;
            freshen_ui();
        }
        catch (ex) { }
    }
    setInterval(load_ui, 1000);

    function freshen_ui() {
        try {
            var yt_id = get_id(),
                pdata = yt_id ? get_cached_pdata(yt_id) : null,
                msg = '';
            
            if (!yt_id)
                msg = 'video id not found';
            else if (!pdata)
                msg = 'playerdata not found in cache';
            else if (!ui_nick.value)
                msg = 'put your discord tag in the username field';

            ui_dl.style.display = pdata ? '' : 'none';
            ui_msg.style.display = msg ? '' : 'none';
            ui_msg.textContent = msg;
        } catch (ex) {
            log('freshen_ui failed, ' + ex, true);
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

    function namechange() {
        localStorage.setItem('ytmc_nick', this.value);
        freshen_ui();
    }

    function scrape_pdata() {
        if (!get_id())
            return freshen_ui();

        var pdata = QS('ytd-watch-flexy');
        if (!pdata || !pdata.playerData)
            return log('no video found', true);

        pdata = pdata.playerData;
        var mf_url = pdata.streamingData.dashManifestUrl || pdata.streamingData.hlsManifestUrl;
        if (!mf_url || !mf_url.length)
            return log('no playerdata found', true);

        if (previous_manifest_url == mf_url)
            return;

        var yt_id = pdata.videoDetails.videoId,
            now = Math.floor(Date.now() / 1000);

        if (yt_id != get_id())
            return log(`yt_id ${yt_id} != get_id ${get_id()} ??`);

        clean_localstore(yt_id);
        localStorage.setItem(
            `ytmc_${now}_${yt_id}`,
            JSON.stringify(pdata));

        log(`stored ${yt_id}`);
        previous_manifest_url = mf_url;
        freshen_ui();
        send_to_server();
    }
    // youtube reuses the player ui when switching streams
    // so be aggressive to get rid of confusing messages
    setInterval(scrape_pdata, 2000);

    function send_to_server() {
        var yt_id = get_id(),
            pdata = get_cached_pdata(yt_id);
        
        if (!pdata)
            return alert('could not retrieve pdata from localstore (ytmc userscript bug)');

        ui_tx.style.display = '';
        if (!ui_nick.value)
            return;

        pdata = JSON.parse(pdata);

        fetch(ytmc_server, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                'nick': ui_nick.value,
                'vid': yt_id,
                'title': pdata.videoDetails.title,
                'chan': pdata.videoDetails.author
            })
        }).then(res => {
            if (res.ok < 400) {
                log(`announced ${yt_id} to server with username "${ui_nick.value}"`);
                ui_tx.style.display = 'none';
            }
            else {
                var msg = `announcing ${yt_id} to server FAILED, error ${res.code}`;
                log(msg);
                res.text().then(res2 => {
                    log(`${msg}, ${res2}`);
                });
            }
        }, res => {
            log(`announcing ${yt_id} to server FAILED, likely due to umatrix or network issues: ${res}`)
        });
    }

    function get_cached_pdata(yt_id) {
        for (var key in localStorage) {
            var match = /^ytmc_([0-9]+)_(.*)/.exec(key);
            if (!match)
                continue;

            if (match[2] == yt_id)
                return localStorage.getItem(key);
        }
    }

    function clean_localstore(rm_vid) {
        var rm = [], now = Math.floor(Date.now() / 1000);
        for (var key in localStorage) {
            var match = /^ytmc_([0-9]+)_(.*)/.exec(key);
            if (!match)
                continue;

            var t = match[1],
                yt_id = match[2],
                td = now - parseInt(t),
                expired = td - (60 * 60 * 6); // 6h

            if (yt_id == rm_vid) {
                log(`removing ${yt_id} (replaced with newer manifest)`);
                rm.push(key);
            }
            else if (expired > 0) {
                log(`removing ${yt_id} (expired ${expired} sec ago)`);
                rm.push(key);
            }
        }
        for (var key of rm)
            try {
                localStorage.removeItem(key);
            }
            catch (ex) { }
    }

    async function download_pdata() {
        var pdata = get_cached_pdata(get_id());
        if (!pdata)
            return alert('json lookup failed, userscript broke, try grabbing from localstore');

        pdata = JSON.parse(pdata);

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
                yt_id = pdata.videoDetails.videoId;

            try {
                thumbnailUrl = pdata.microformat.playerMicroformatRenderer.thumbnail.thumbnails[0].url;
                start_ts = pdata.microformat.playerMicroformatRenderer.liveBroadcastDetails.startTimestamp;
            }
            catch (ex) {
                thumbnailUrl = `https://img.youtube.com/vi/${yt_id}/maxresdefault.jpg`
            }

            return {
                title: pdata.videoDetails.title,
                id: yt_id,
                channelName: pdata.videoDetails.author,
                channelURL: "https://www.youtube.com/channel/" + pdata.videoDetails.channelId,
                description: pdata.videoDetails.shortDescription,
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
        // document.querySelector('ytd-watch-flexy').playerData.streamingData.adaptiveFormats
        for (var af of pdata.streamingData.adaptiveFormats)
            if (af.url)
                result[af.itag + ''] = af.url;

        var found = 0;
        for (const itag of PRIORITY.VIDEO) {
            if (Object.keys(result).includes(itag.toString()) && result[itag.toString()].includes("noclen")) {
                best.video = {
                    [itag.toString()]: result[itag.toString()]
                };
                found++;
                break;
            }
        }
        for (const itag of PRIORITY.AUDIO) {
            if (Object.keys(result).includes(itag.toString()) && result[itag.toString()].includes("noclen")) {
                best.audio = {
                    [itag.toString()]: result[itag.toString()]
                };
                found++;
                break;
            }
        }
        if (found != 2) {
            alert('this video does not have stream URLs exposed directly in the playerdata\n\nyou will now get a janky json which WILL NOT WORK without fixing it by grabbing the stream URLs from the attached manifest manually');
            best.dash = pdata.streamingData.dashManifestUrl;
            best.hls = pdata.streamingData.hlsManifestUrl;
        }
        download(JSON.stringify(best, null, 4), `${get_id()}.urls.json`, "application/json");
    }

    var s = document.createElement('style');
    s.innerHTML = `
        #ytmc_ui {
            padding: .5em 0;
            font-size: 1.3em;
            line-height: 1.8em;
            position: relative;
            z-index: 9001;
            color: var(--yt-spec-text-primary);
        }
        #ytmc_ui button,
        #ytmc_msg {
            margin: 0 .2em;
        }
        #ytmc_nick {
            margin-right: 2em;
        }
        #ytmc_msg {
            color: #fff;
            background: #820;
            white-space: pre;
            font-weight: bold;
            padding: .1em .4em;
            border-radius: .3em;
            box-shadow: .2em .2em 0 #c70;
        }
    `;
    document.head.appendChild(s);
    log(`stage 2 ok: ${document.location.href}`);
}

var scr = document.createElement('script');
scr.textContent = '(' + grunnur.toString() + ')();';
(document.head || document.getElementsByTagName('head')[0]).appendChild(scr);

console.log(`[ytmc] ${new Date().toISOString().split('T')[1]} stage 1 ok: ${document.location.href}`);

/*
https://www.youtube.com/watch?v=zdUJ4bIiRs0 mengen
https://www.youtube.com/watch?v=VHwQp1XtWLA priv
https://www.youtube.com/watch?v=02vRF2yi8VY priv
https://www.youtube.com/watch?v=0nZxBDK_UII gone
*/

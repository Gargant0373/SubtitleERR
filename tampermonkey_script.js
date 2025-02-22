// ==UserScript==
// @name         ERR Subtitle Translator
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Intercepts subtitle requests, translates Estonian to English using a local server, and returns translated subtitles.
// @author       Your Name
// @match        *://jupiter.err.ee/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const subtitlePattern = /https:\/\/vod\.err\.ee\/hls\/vod\/1351583\/2\/v\/fragment-\d+-f4\.vtt/;

    const originalFetch = window.fetch;

    window.fetch = async function(resource, init) {
        if (typeof resource === "string" && subtitlePattern.test(resource)) {
            console.log("[SubtitleTranslator] Intercepted subtitle request:", resource);

            const response = await originalFetch(resource, init);
            let text = await response.text();

            const lines = text.split('\n');
            const translatedLines = await Promise.all(lines.map(async line => {
                if (
                    !line.trim() ||
                    line === "WEBVTT" ||
                    line.startsWith("NOTE") ||
                    line.includes("-->") ||
                    /^\d+$/.test(line.trim())
                ) {
                    return line;
                }

                try {
                    const translationResponse = await originalFetch("http://localhost:5000/translate", {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({ text: line })
                    });

                    if (translationResponse.ok) {
                        const json = await translationResponse.json();
                        console.log(`[SubtitleTranslator] Translated: "${line.trim()}" -> "${json.translation.trim()}"`);
                        return json.translation;
                    } else {
                        console.error("[SubtitleTranslator] Translation server error:", translationResponse.status);
                        return line;
                    }
                } catch (e) {
                    console.error("[SubtitleTranslator] Error calling translation server:", e);
                    return line;
                }
            }));

            const newText = translatedLines.join('\n');
            const newHeaders = new Headers(response.headers);
            newHeaders.set("Content-Type", "text/vtt; charset=utf-8");
            return new Response(newText, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders
            });
        } else {
            return originalFetch(resource, init);
        }
    };
})();

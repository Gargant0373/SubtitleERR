// ==UserScript==
// @name         ERR Subtitle Translator
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Intercepts subtitle requests, translates Estonian to English using a local server, and returns translated subtitles using batch processing.
// @author       Alex Despan
// @match        *://jupiter.err.ee/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const subtitlePattern = /https:\/\/vod\.err\.ee\/hls\/vod\/1351583\/2\/v\/fragment-\d+-f4\.vtt/;
    const originalFetch = window.fetch;

    window.fetch = async function (resource, init) {
        if (typeof resource === "string" && subtitlePattern.test(resource)) {
            console.log("[SubtitleTranslator] Intercepted subtitle request:", resource);
            const start = performance.now();
            const response = await originalFetch(resource, init);
            let text = await response.text();

            const lines = text.split('\n');
            // Prepare arrays for batch translation
            let indicesToTranslate = [];
            let textsToTranslate = [];

            lines.forEach((line, index) => {
                if (
                    !line.trim() ||
                    line === "WEBVTT" ||
                    line.startsWith("NOTE") ||
                    line.includes("-->") ||
                    /^\d+$/.test(line.trim()) ||
                    line.includes("ERR")
                ) { } else {
                    indicesToTranslate.push(index);
                    textsToTranslate.push(line);
                }
            });

            // If there are lines to translate, send them in one batch request
            if (textsToTranslate.length > 0) {
                try {
                    const translationResponse = await originalFetch("http://localhost:5000/translate_batch", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ texts: textsToTranslate })
                    });
                    if (translationResponse.ok) {
                        const json = await translationResponse.json();
                        // Expect json.translations to be an array corresponding to textsToTranslate order.
                        const translatedTexts = json.translations;
                        const end = performance.now();
                        console.log(`[SubtitleTranslator] Batch translation took ${end - start} ms`, translatedTexts);
                        // Replace the corresponding lines in the original array
                        indicesToTranslate.forEach((idx, i) => {
                            lines[idx] = translatedTexts[i] || lines[idx];
                        });
                    } else {
                        console.error("[SubtitleTranslator] Batch translation server error:", translationResponse.status);
                    }
                } catch (e) {
                    console.error("[SubtitleTranslator] Error calling batch translation server:", e);
                }
            }

            const newText = lines.join('\n');
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

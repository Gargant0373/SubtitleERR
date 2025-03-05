// ==UserScript==
// @name         ERR Subtitle Translator
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Translates ERR subtitles from Estonian to English
// @author       ---
// @match        https://*.err.ee/*
// @match        https://jupiter.err.ee/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @connect      vod.err.ee
// @run-at       document-start
// ==/UserScript==

/*
The previous script did not properly fetch the .vtt files. The first reason was that each
.vtt file has a unique URL e.g.
https://vod.err.ee/hls/vod/1337094/12/v/fragment-52-f5.vtt
has the show/movie ID as 1337094, this ID can be found in the name of the .vtt file.
So I just fetch all .vtt files.
The second issue I had was that the .vtt files were not being fetched. So I changed the script
to use GM_xmlhttpRequest to fetch the .vtt files. I do not know whether this was necessary,
but chatGPT suggested it.
Note that for the subtitles to be fetched correctly, you need to have subtitles enabled in the 
video player. Furthermore, currently it overlays the english subtitles ontop of the estonian ones,
which you probably don't want.
*/

(function() {
    'use strict';
    console.log('[SubtitleTranslator] Script starting');

    // Function to inject new translated subtitle track into the DOM
    function injectTranslatedSubtitles(videoElement, modifiedVTT) {
        // Remove existing subtitle track
        const existingTracks = videoElement.querySelectorAll('track[kind="subtitles"]');
        existingTracks.forEach(track => track.remove());

        // Create a new Blob with the translated subtitles
        const vttBlob = new Blob([modifiedVTT], { type: 'text/vtt' });
        const vttUrl = URL.createObjectURL(vttBlob);

        // Create a new track element
        const newTrack = document.createElement('track');
        newTrack.kind = 'subtitles';
        newTrack.label = 'Translated English';
        newTrack.src = vttUrl; // Use the Blob URL with the modified VTT content
        newTrack.default = true;

        // Append the new track to the video element
        videoElement.appendChild(newTrack);
        console.log('[SubtitleTranslator] Injected translated subtitles');
    }

    const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
            if (entry.name.includes('.vtt')) {
                console.log('[SubtitleTranslator] VTT resource detected:', entry.name);

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: entry.name,
                    onload: function(response) {
                        if (response.responseText && response.responseText.includes('-->')) {
                            const lines = response.responseText.split('\n');
                            const textsToTranslate = [];
                            const indicesToTranslate = [];

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

                            if (textsToTranslate.length > 0) {
                                console.log('[SubtitleTranslator] Texts to translate:', textsToTranslate);

                                GM_xmlhttpRequest({
                                    method: 'POST',
                                    url: 'http://localhost:5000/translate_batch',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Accept': 'application/json'
                                    },
                                    data: JSON.stringify({
                                        texts: textsToTranslate
                                    }),
                                    onload: function(translationResponse) {
                                        try {
                                            const result = JSON.parse(translationResponse.responseText);
                                            console.log('[SubtitleTranslator] Translations received:', result.translations);

                                            // Replace original subtitles with translations
                                            indicesToTranslate.forEach((idx, i) => {
                                                lines[idx] = result.translations[i] || lines[idx];
                                            });

                                            // Create modified VTT content
                                            const modifiedVTT = lines.join('\n');
                                            console.log('[SubtitleTranslator] Modified VTT:', modifiedVTT);

                                            // Inject the modified VTT into the video element
                                            const videoElement = document.querySelector('video');
                                            if (videoElement) {
                                                injectTranslatedSubtitles(videoElement, modifiedVTT);
                                            } else {
                                                console.error('[SubtitleTranslator] Video element not found');
                                            }

                                        } catch (e) {
                                            console.error('[SubtitleTranslator] Error parsing translation:', e);
                                        }
                                    },
                                    onerror: function(error) {
                                        console.error('[SubtitleTranslator] Translation request failed:', error);
                                    }
                                });
                            }
                        }
                    },
                    onerror: function(error) {
                        console.error('[SubtitleTranslator] Error fetching VTT:', error);
                    }
                });
            }
        });
    });

    observer.observe({ entryTypes: ['resource'] });
})();

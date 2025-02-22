ERR Subtitle Translator

This project allows you to watch an Estonian show without built-in English subtitles by locally translating the subtitle fragments. It consists of three main components:

    Translation Server (server.py):
    A Flask-based server that uses Helsinki-NLP's MarianMT model to translate subtitle text from Estonian to English in real time.

    Tampermonkey Script:
    A browser script that intercepts subtitle network requests on the ERR video site, sends the subtitle text to your local translation server, and replaces the fetched subtitles with the translated text.

    Offline Translation Script (translate.py):
    A standalone Python script that downloads, merges, cleans, and translates subtitle fragments offline. (Note: This script works but is not recommended for live translation due to processing delays.)

Requirements

Make sure you have Python 3.8+ installed, and then install the required packages with:

pip install -r requirements.txt

The requirements.txt includes dependencies such as:

    flask
    flask-cors
    transformers
    torch
    requests

Running the Translation Server

The Flask server provides a /translate endpoint for handling translation requests.

    Navigate to the project directory.

    Start the server:

    python server.py

    The server will run on http://localhost:5000. It automatically loads the MarianMT model and tokenizer, moving the model to the GPU if available.

Installing the Tampermonkey Script

    Install Tampermonkey in your browser if you haven't already.

    Create a new script in Tampermonkey:
        Open Tampermonkey's dashboard and click on "Create a new script."

    Copy and paste the provided script into the editor. For example:

    // ==UserScript==
    // @name         ERR Subtitle Translator
    // @namespace    http://tampermonkey.net/
    // @version      0.1
    // @description  Intercepts subtitle requests and translates Estonian to English using a local server.
    // @author       Your Name
    // @match        *://vod.err.ee/*
    // @grant        none
    // ==/UserScript==

    (function() {
        'use strict';

        // Regex to match subtitle fragment URLs
        const subtitlePattern = /https:\/\/vod\.err\.ee\/hls\/vod\/1351583\/2\/v\/fragment-\d+-f4\.vtt/;

        // Reference to the original fetch function
        const originalFetch = window.fetch;
        
        // Override the global fetch function
        window.fetch = async function(resource, init) {
            if (typeof resource === "string" && subtitlePattern.test(resource)) {
                console.log("[SubtitleTranslator] Intercepted subtitle request:", resource);
                
                // Get the original subtitle file
                const response = await originalFetch(resource, init);
                let text = await response.text();
                
                // Split into lines and process each line
                const lines = text.split('\n');
                const translatedLines = await Promise.all(lines.map(async line => {
                    // Skip non-text lines (headers, timestamps, cue numbers)
                    if (!line.trim() || line === "WEBVTT" || line.startsWith("NOTE") || line.includes("-->") || /^\d+$/.test(line.trim())) {
                        return line;
                    }
                    
                    // Translate text via the local server
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
                
                // Set the correct MIME type and charset for the translated subtitles
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

    Save the script.

When you navigate to a video on vod.err.ee, the script will intercept subtitle fragment requests, call your local translation server, and substitute the translated subtitles for the original ones.
Offline Translation Script

The translate.py script demonstrates how to:

    Fetch and merge subtitle fragments,
    Clean up unwanted text,
    Translate the subtitles using the MarianMT model.

Usage:

python translate.py

Note: While this script successfully translates subtitles offline, it is not a practical solution for live viewing because it processes subtitles in a batch manner rather than in real time. The Flask server combined with the Tampermonkey script is the recommended approach for real-time subtitle translation.
Troubleshooting

    Garbled Text:
    If you see random characters in the subtitles, ensure the Tampermonkey script sets the Content-Type header correctly to text/vtt; charset=utf-8.

    Model Performance:
    Translation speed can be improved by ensuring your system uses the GPU (if available).

    Network Issues:
    Verify that your local server is running and accessible at http://localhost:5000.
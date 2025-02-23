
# ERR Subtitle Translator
This project allows you to watch an Estonian show without built-in English subtitles by locally translating the subtitle fragments. It consists of three main components:

**Translation Server** (`server.py`):
A Flask-based server that uses Helsinki-NLP's MarianMT model to translate subtitle text from Estonian to English in real time.

**Tampermonkey Script:**

A browser script that intercepts subtitle network requests on the ERR video site, sends the subtitle text to your local translation server, and replaces the fetched subtitles with the translated text.

**Offline Translation Script (translate.py):**

A standalone Python script that downloads, merges, cleans, and translates subtitle fragments offline. (Note: This script works but is not recommended for live translation due to processing delays.)

## Requirements
Make sure you have Python 3.8+ installed, and then install the required packages with:
`pip install -r requirements.txt`

It is recommended (but not required) to create a virtual environment.

## Running the Translation Server
The Flask server provides a /translate_batch endpoint for handling translation requests.

1. Navigate to the project directory.
2. Start the server: `python src/server.py`

The server will run on http://localhost:5000. It automatically loads the MarianMT model and tokenizer, moving the model to the GPU if available.

## Installing the Tampermonkey Script
1. Install Tampermonkey in your browser if you haven't already.
2. Create a new script in Tampermonkey:
3. Open Tampermonkey's dashboard and click on "Create a new script."
4. Add the tampermonkey_script.js contents in it.
5. Save the script.

When you navigate to a video on jupiter.err.ee, the script will intercept subtitle fragment requests, call your local translation server, and substitute the translated subtitles for the original ones.

## Offline Translation Script

The translate.py script demonstrates how to:
1. Fetch and merge subtitle fragments,
2. Clean up unwanted text,
3. Translate the subtitles using the MarianMT model.

Usage: `python translate.py`

Note: While this script successfully translates subtitles offline, it is not a practical solution for live viewing because it processes subtitles in a batch manner rather than in real time. The Flask server combined with the Tampermonkey script is the recommended approach for real-time subtitle translation. You also need to provide the API call in the code. 

## Troubleshooting
**Model Performance:**
Translation speed can be improved by ensuring your system uses the GPU (if available).

**Network Issues:**
Verify that your local server is running and accessible at http://localhost:5000.

import requests
import os
from transformers import MarianMTModel, MarianTokenizer
import torch
import logging

# Configure logging for cleaner console output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Base URL for subtitle fragments
BASE_URL = "https://vod.err.ee/hls/vod/1351583/2/v/fragment-{}-f4.vtt"

# Directory to save subtitles
SAVE_DIR = "subtitles"
os.makedirs(SAVE_DIR, exist_ok=True)

# Files to save subtitles
MERGED_SUBTITLE_FILE = os.path.join(SAVE_DIR, "merged_subtitles.vtt")
CLEANED_SUBTITLE_FILE = os.path.join(SAVE_DIR, "cleaned_subtitles.vtt")
TRANSLATED_SUBTITLE_FILE = os.path.join(SAVE_DIR, "translated_subtitles.vtt")

def fetch_subtitle(fragment_index):
    """Fetch a subtitle fragment and return its content as bytes."""
    url = BASE_URL.format(fragment_index)
    try:
        response = requests.get(url)
    except Exception as e:
        logging.error(f"Error fetching fragment-{fragment_index}: {e}")
        return b""
    
    if response.status_code == 404:
        return None  # Stop fetching when no more fragments exist
    elif response.status_code != 200:
        logging.warning(f"Failed to fetch fragment-{fragment_index}, Status Code: {response.status_code}")
        return b""  # Return empty bytes on failure

    return response.content

def merge_subtitles():
    """Fetch all subtitle fragments, merge them, and ensure proper encoding."""
    merged_subtitles = []
    fragment_index = 0

    while True:
        subtitle_content = fetch_subtitle(fragment_index)
        if subtitle_content is None:
            break  # No more fragments
        
        subtitle_text = subtitle_content.decode("utf-8", errors="replace")
        merged_subtitles.append(subtitle_text)
        logging.info(f"Fetched fragment-{fragment_index}")
        fragment_index += 1

    with open(MERGED_SUBTITLE_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(merged_subtitles))

    logging.info(f"Merged subtitles saved to {MERGED_SUBTITLE_FILE}")

def clean_subtitles():
    """Clean up unnecessary lines and ensure proper formatting."""
    with open(MERGED_SUBTITLE_FILE, "r", encoding="utf-8", errors="replace") as f:
        subtitles = f.readlines()

    cleaned_subtitles = []
    seen_subtitles = set()
    webvtt_header_added = False

    for line in subtitles:
        line = line.strip()
        if line == "WEBVTT":
            if webvtt_header_added:
                continue  # Skip duplicate header
            else:
                webvtt_header_added = True
                cleaned_subtitles.append("WEBVTT\n")
        elif "ERR Heli tekstiks" in line or line.startswith("NOTE"):
            continue
        elif line in seen_subtitles:
            continue
        else:
            seen_subtitles.add(line)
            cleaned_subtitles.append(line)

    with open(CLEANED_SUBTITLE_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(cleaned_subtitles))

    logging.info(f"Cleaned subtitles saved to {CLEANED_SUBTITLE_FILE}")

def translate(text):
    """Translate given text using Helsinki-NLP's MarianMT model."""
    model_name = 'Helsinki-NLP/opus-mt-et-en'
    tokenizer = MarianTokenizer.from_pretrained(model_name)
    model = MarianMTModel.from_pretrained(model_name)
    
    # Move model to GPU if available
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    
    # Tokenize and move inputs to the correct device
    inputs = tokenizer(text, return_tensors="pt", padding=True)
    inputs = {key: val.to(device) for key, val in inputs.items()}
    
    translated_tokens = model.generate(**inputs)
    translation = tokenizer.decode(translated_tokens[0], skip_special_tokens=True)
    
    return translation

def translate_subtitles():
    """Translate cleaned subtitles while preserving formatting."""
    with open(CLEANED_SUBTITLE_FILE, "r", encoding="utf-8") as f:
        subtitles = f.readlines()

    translated_subtitles = []
    for line in subtitles:
        # Preserve timestamps, empty lines, numbers, and header
        if "-->" in line or not line.strip() or line.strip().isdigit() or line.strip() == "WEBVTT":
            translated_subtitles.append(line)
            continue
        
        translation = translate(line)
        translated_subtitles.append(translation)
        logging.info(f"Translated: '{line.strip()}' -> '{translation.strip()}'")

    with open(TRANSLATED_SUBTITLE_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(translated_subtitles))

    logging.info(f"Translated subtitles saved to {TRANSLATED_SUBTITLE_FILE}")

if __name__ == "__main__":
    merge_subtitles()
    clean_subtitles()
    translate_subtitles()

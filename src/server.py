import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import MarianMTModel, MarianTokenizer
import torch

app = Flask(__name__)
CORS(app)

# Model configuration
MODEL_NAME = 'Helsinki-NLP/opus-mt-et-en'

# Load model and tokenizer once at startup
tokenizer = MarianTokenizer.from_pretrained(MODEL_NAME)
model = MarianMTModel.from_pretrained(MODEL_NAME)

# Move model to GPU if available
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

def translate(text):
    """Translate given text using Helsinki-NLP's MarianMT model."""
    # Tokenize and move inputs to the correct device
    inputs = tokenizer(text, return_tensors="pt", padding=True)
    inputs = {key: val.to(device) for key, val in inputs.items()}
    
    translated_tokens = model.generate(**inputs)
    translation = tokenizer.decode(translated_tokens[0], skip_special_tokens=True)
    
    return translation

@app.route('/translate_batch', methods=['POST'])
def translate_batch():
    """Translate a batch of texts."""
    data = request.get_json()
    if not data or 'texts' not in data:
        return jsonify({'error': 'No texts provided. Please include "texts" in the JSON payload.'}), 400

    texts = data['texts']
    translations = []
    start = time.time()
    try:
        for text in texts:
            translations.append(translate(text))
    except Exception as e:
        return jsonify({'error': f"Translation failed: {str(e)}"}), 500
    end = time.time()
    print(f"Translated batch in {end - start:.2f} seconds")
    return jsonify({'translations': translations})

if __name__ == '__main__':
    app.run(debug=False, port=5000)

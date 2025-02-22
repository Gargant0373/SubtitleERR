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

@app.route('/translate', methods=['POST'])
def translate_endpoint():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'No text provided. Please include "text" in the JSON payload.'}), 400
    
    text = data['text']
    try:
        translated_text = translate(text)
    except Exception as e:
        return jsonify({'error': f"Translation failed: {str(e)}"}), 500
    
    return jsonify({'translation': translated_text})

if __name__ == '__main__':
    # Run the Flask server on port 5000
    app.run(debug=True, port=5000)

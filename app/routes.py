from flask import Flask
import os
import openai
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Set OpenAI API key from environment variable
openai.api_key = os.getenv("OPENAI_API_KEY")

from flask import Blueprint, render_template, request, jsonify, current_app
import requests
from app.chat_handler import get_chat_response

main = Blueprint('main', __name__)

@main.route('/')
def index():
    return render_template('index.html')

@main.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message', '')
    bot_response = get_chat_response(user_message)
    return jsonify({'response': bot_response})

@main.route('/get-token', methods=['GET'])
def get_token():
    try:
        response = requests.post(
            "https://api.openai.com/v1/realtime/sessions",
            headers={
                "Authorization": f"Bearer {current_app.config['OPENAI_API_KEY']}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-realtime-preview-2024-12-17",
                "voice": "verse",
            },
        )
        return jsonify(response.json())
    except Exception as e:
        print(f"Error in get_token: {str(e)}")
        return jsonify({"error": str(e)}), 500
from openai import OpenAI
from flask import current_app

def get_chat_response(message):
    try:
        client = OpenAI(api_key=current_app.config['OPENAI_API_KEY'])
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": message}
            ]
        )
        
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error: {str(e)}")
        return "I apologize, but I encountered an error processing your request."

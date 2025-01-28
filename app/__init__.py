from flask import Flask
import os
from dotenv import load_dotenv

load_dotenv()

from config import Config

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    from app.routes import main as main_blueprint
    app.register_blueprint(main_blueprint, url_prefix='')

    return app
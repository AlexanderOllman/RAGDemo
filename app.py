from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
import os
import json
import warnings

#from pymilvus import Collection, CollectionSchema, DataType, FieldSchema, connections
from langchain_milvus.retrievers import MilvusCollectionHybridSearchRetriever
from langchain_community.embeddings.openai import OpenAIEmbeddings
from langchain_milvus import Milvus
from langchain_community.document_loaders import PyPDFLoader
from langchain.prompts import PromptTemplate
from langchain.text_splitter import RecursiveCharacterTextSplitter
#import tiktoken
from langchain_community.chat_models import ChatOpenAI
from langchain.chains import RetrievalQA
from langchain.chains import RetrievalQAWithSourcesChain
from langchain_core._api.deprecation import LangChainDeprecationWarning
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings
warnings.filterwarnings("ignore", category=DeprecationWarning)

app = Flask(__name__)
socketio = SocketIO(app)

# Initialize ChromaDB
chroma_client = chromadb.Client(Settings(persist_directory="./chroma_db"))
collection = chroma_client.create_collection(name="chatbot_collection")

# Initialize local embeddings model
embeddings_model = SentenceTransformer('all-MiniLM-L6-v2')

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/history')
def history():
    return render_template('history.html')

@app.route('/settings')
def settings():
    return render_template('settings.html')

@app.route('/upload_file', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'})
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'})
    if file:
        filename = file.filename
        file_path = os.path.join('uploads', filename)
        file.save(file_path)
        add_file_to_vector_db(file_path)
        return jsonify({'success': True, 'filename': filename})

@app.route('/get_uploaded_files')
def get_uploaded_files():
    files = os.listdir('uploads')
    return jsonify(files)

@app.route('/delete_file', methods=['POST'])
def delete_file():
    filename = request.json['filename']
    file_path = os.path.join('uploads', filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        delete_file_from_vector_db(filename)
        return jsonify({'success': True})
    return jsonify({'error': 'File not found'})

@app.route('/save_conversation', methods=['POST'])
def save_conversation():
    conversation = request.json['conversation']
    # Save conversation to a file or database
    # For simplicity, we'll save it to a JSON file
    with open('conversations.json', 'a') as f:
        json.dump(conversation, f)
        f.write('\n')
    return jsonify({'success': True})

@app.route('/get_conversations')
def get_conversations():
    conversations = []
    if os.path.exists('conversations.json'):
        with open('conversations.json', 'r') as f:
            for line in f:
                conversations.append(json.loads(line))
    return jsonify(conversations)

@socketio.on('chat_message')
def handle_chat_message(message):
    # Here you would call your LLM function
    # For now, we'll just echo the message
    response = f"Echo: {message}"
    emit('chat_response', {'message': response})

def add_file_to_vector_db(file_path):
    with open(file_path, 'r') as file:
        content = file.read()
    embedding = embeddings_model.encode(content)
    collection.add(
        documents=[content],
        metadatas=[{"source": file_path}],
        ids=[file_path]
    )

def delete_file_from_vector_db(filename):
    collection.delete(ids=[filename])

def retrieve_from_vector_db(query):
    embedding = embeddings_model.encode(query)
    results = collection.query(
        query_embeddings=[embedding.tolist()],
        n_results=5
    )
    return results

if __name__ == '__main__':
    # socketio.run(app, debug=True)
    socketio.run(app, debug=True, host='0.0.0.0', port='8080')
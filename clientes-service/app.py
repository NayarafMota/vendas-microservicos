# clientes-service/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import redis
import json
import os
from datetime import datetime
from threading import Thread
import time
from queue import Queue
import logging

app = Flask(__name__)
CORS(app)

# Configuração de logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuração MongoDB
MONGO_HOST = os.getenv('MONGO_HOST', 'localhost')
MONGO_PORT = int(os.getenv('MONGO_PORT', 27017))
mongo_client = MongoClient(MONGO_HOST, MONGO_PORT)
db = mongo_client.clientes_db
clientes_collection = db.clientes

# Configuração Redis
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

# Fila para processamento assíncrono
processing_queue = Queue()

class ClienteProcessor:
    """Worker thread para processamento assíncrono de clientes"""
    
    def __init__(self):
        self.running = True
        self.thread = Thread(target=self.process_queue, daemon=True)
        self.thread.start()
    
    def process_queue(self):
        while self.running:
            try:
                if not processing_queue.empty():
                    task = processing_queue.get(timeout=1)
                    self.process_cliente(task)
                    processing_queue.task_done()
                else:
                    time.sleep(0.1)
            except Exception as e:
                logger.error(f"Erro no processamento: {e}")
    
    def process_cliente(self, task):
        """Processa validações e normalizações do cliente"""
        cliente = task['cliente']
        action = task['action']
        
        # Simula processamento (validações, normalizações, etc.)
        time.sleep(0.1)
        
        if action == 'create':
            # Normalizar telefone
            cliente['telefone'] = self.normalize_phone(cliente['telefone'])
            logger.info(f"Cliente {cliente['nome']} processado e normalizado")
        
        # Publicar evento no Redis
        redis_client.publish('cliente:processed', json.dumps({
            'action': action,
            'cliente': cliente,
            'timestamp': datetime.now().isoformat()
        }))
    
    def normalize_phone(self, phone):
        """Normaliza número de telefone"""
        # Remove caracteres não numéricos
        normalized = ''.join(filter(str.isdigit, phone))
        return normalized

# Inicializar worker
cliente_processor = ClienteProcessor()

# Cache helpers
def get_from_cache(key):
    try:
        cached = redis_client.get(key)
        return json.loads(cached) if cached else None
    except Exception as e:
        logger.error(f"Erro no cache: {e}")
        return None

def set_cache(key, data, ttl=300):
    try:
        redis_client.setex(key, ttl, json.dumps(data, default=str))
    except Exception as e:
        logger.error(f"Erro ao salvar no cache: {e}")

# Rotas
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'service': 'clientes',
        'database': 'connected' if mongo_client.admin.command('ping') else 'disconnected'
    })

@app.route('/clientes', methods=['GET'])
def listar_clientes():
    try:
        # Buscar do cache primeiro
        cached = get_from_cache('clientes:all')
        if cached:
            return jsonify({'data': cached, 'source': 'cache'})
        
        # Buscar do MongoDB
        clientes = list(clientes_collection.find({}, {'_id': 0}))
        
        # Salvar no cache
        set_cache('clientes:all', clientes)
        
        return jsonify({'data': clientes, 'source': 'database'})
    
    except Exception as e:
        logger.error(f"Erro ao listar clientes: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500

@app.route('/clientes/<int:cliente_id>', methods=['GET'])
def buscar_cliente(cliente_id):
    try:
        # Buscar do cache
        cached = get_from_cache(f'cliente:{cliente_id}')
        if cached:
            return jsonify({'data': cached, 'source': 'cache'})
        
        # Buscar do MongoDB
        cliente = clientes_collection.find_one({'id': cliente_id}, {'_id': 0})
        
        if not cliente:
            return jsonify({'error': 'Cliente não encontrado'}), 404
        
        # Salvar no cache
        set_cache(f'cliente:{cliente_id}', cliente)
        
        return jsonify({'data': cliente, 'source': 'database'})
    
    except Exception as e:
        logger.error(f"Erro ao buscar cliente: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500

@app.route('/clientes', methods=['POST'])
def cadastrar_cliente():
    try:
        data = request.get_json()
        
        if not data.get('nome') or not data.get('telefone'):
            return jsonify({'error': 'Nome e telefone são obrigatórios'}), 400
        
        # Gerar ID único
        ultimo_id = clientes_collection.find_one(sort=[('id', -1)])
        novo_id = (ultimo_id['id'] if ultimo_id else 0) + 1
        
        cliente = {
            'id': novo_id,
            'nome': data['nome'],
            'telefone': data['telefone'],
            'created_at': datetime.now()
        }
        
        # Inserir no MongoDB
        clientes_collection.insert_one(cliente.copy())
        
        # Adicionar à fila de processamento assíncrono
        processing_queue.put({
            'action': 'create',
            'cliente': cliente
        })
        
        # Invalidar cache
        redis_client.delete('clientes:all')
        
        # Remover _id para response
        cliente.pop('_id', None)
        
        return jsonify({'data': cliente}), 201
    
    except Exception as e:
        logger.error(f"Erro ao cadastrar cliente: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500

@app.route('/clientes/<int:cliente_id>', methods=['PUT'])
def atualizar_cliente(cliente_id):
    try:
        data = request.get_json()
        
        # Verificar se cliente existe
        cliente_existente = clientes_collection.find_one({'id': cliente_id})
        if not cliente_existente:
            return jsonify({'error': 'Cliente não encontrado'}), 404
        
        # Atualizar dados
        dados_atualizacao = {}
        if data.get('nome'):
            dados_atualizacao['nome'] = data['nome']
        if data.get('telefone'):
            dados_atualizacao['telefone'] = data['telefone']
        
        dados_atualizacao['updated_at'] = datetime.now()
        
        # Atualizar no MongoDB
        clientes_collection.update_one(
            {'id': cliente_id},
            {'$set': dados_atualizacao}
        )
        
        # Buscar cliente atualizado
        cliente_atualizado = clientes_collection.find_one({'id': cliente_id}, {'_id': 0})
        
        # Invalidar caches
        redis_client.delete('clientes:all')
        redis_client.delete(f'cliente:{cliente_id}')
        
        # Adicionar à fila de processamento
        processing_queue.put({
            'action': 'update',
            'cliente': cliente_atualizado
        })
        
        return jsonify({'data': cliente_atualizado})
    
    except Exception as e:
        logger.error(f"Erro ao atualizar cliente: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500

@app.route('/clientes/stats', methods=['GET'])
def estatisticas_clientes():
    """Endpoint para estatísticas (demonstra agregação MongoDB)"""
    try:
        # Pipeline de agregação
        pipeline = [
            {
                '$group': {
                    '_id': None,
                    'total': {'$sum': 1},
                    'primeiro_cadastro': {'$min': '$created_at'},
                    'ultimo_cadastro': {'$max': '$created_at'}
                }
            }
        ]
        
        result = list(clientes_collection.aggregate(pipeline))
        stats = result[0] if result else {'total': 0}
        
        # Remover _id
        stats.pop('_id', None)
        
        return jsonify({'data': stats})
    
    except Exception as e:
        logger.error(f"Erro ao gerar estatísticas: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
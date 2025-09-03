// produtos-service/server.js
const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');
const cluster = require('cluster');
const os = require('os');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Configuração do PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'produtos_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'password',
});

// Configuração do Redis
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
});

redisClient.on('error', (err) => {
  console.log('Redis Client Error', err);
});

// Inicialização da base de dados
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS produtos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT,
        valor DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabela produtos criada com sucesso');
  } catch (err) {
    console.error('Erro ao criar tabela:', err);
  }
}

// Worker para processamento assíncrono
class ProdutoWorker {
  static async processarProduto(produto) {
    return new Promise((resolve) => {
      // Simula processamento pesado (validações, cálculos, etc.)
      setTimeout(() => {
        console.log(`Produto ${produto.nome} processado no worker`);
        resolve(produto);
      }, 100);
    });
  }
}

// Cache Redis
async function getFromCache(key) {
  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error('Erro no cache:', err);
    return null;
  }
}

async function setCache(key, data, ttl = 300) {
  try {
    await redisClient.setex(key, ttl, JSON.stringify(data));
  } catch (err) {
    console.error('Erro ao salvar no cache:', err);
  }
}

// Rotas
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'produtos', worker: process.pid });
});

// Listar produtos com cache
app.get('/produtos', async (req, res) => {
  try {
    // Tenta buscar do cache primeiro
    const cached = await getFromCache('produtos:all');
    if (cached) {
      return res.json({ data: cached, source: 'cache' });
    }

    const result = await pool.query('SELECT * FROM produtos ORDER BY created_at DESC');
    const produtos = result.rows;

    // Salva no cache
    await setCache('produtos:all', produtos);

    res.json({ data: produtos, source: 'database' });
  } catch (err) {
    console.error('Erro ao listar produtos:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar produto por ID
app.get('/produtos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cached = await getFromCache(`produto:${id}`);
    
    if (cached) {
      return res.json({ data: cached, source: 'cache' });
    }

    const result = await pool.query('SELECT * FROM produtos WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const produto = result.rows[0];
    await setCache(`produto:${id}`, produto);

    res.json({ data: produto, source: 'database' });
  } catch (err) {
    console.error('Erro ao buscar produto:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Cadastrar produto com processamento assíncrono
app.post('/produtos', async (req, res) => {
  try {
    const { nome, descricao, valor } = req.body;

    if (!nome || !valor) {
      return res.status(400).json({ error: 'Nome e valor são obrigatórios' });
    }

    // Processamento assíncrono
    const produtoProcessado = await ProdutoWorker.processarProduto({
      nome,
      descricao,
      valor
    });

    const result = await pool.query(
      'INSERT INTO produtos (nome, descricao, valor) VALUES ($1, $2, $3) RETURNING *',
      [produtoProcessado.nome, produtoProcessado.descricao, produtoProcessado.valor]
    );

    const novoProduto = result.rows[0];

    // Invalidar cache
    await redisClient.del('produtos:all');

    // Publicar evento no Redis
    await redisClient.publish('produto:created', JSON.stringify(novoProduto));

    res.status(201).json({ data: novoProduto });
  } catch (err) {
    console.error('Erro ao cadastrar produto:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar produto
app.put('/produtos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao, valor } = req.body;

    const result = await pool.query(
      'UPDATE produtos SET nome = $1, descricao = $2, valor = $3 WHERE id = $4 RETURNING *',
      [nome, descricao, valor, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const produtoAtualizado = result.rows[0];

    // Invalidar caches
    await redisClient.del('produtos:all');
    await redisClient.del(`produto:${id}`);

    res.json({ data: produtoAtualizado });
  } catch (err) {
    console.error('Erro ao atualizar produto:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Clustering para melhor performance
if (cluster.isMaster && process.env.NODE_ENV === 'production') {
  const numCPUs = os.cpus().length;
  console.log(`Master process iniciando ${numCPUs} workers`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} morreu`);
    cluster.fork();
  });
} else {
  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, async () => {
    await redisClient.connect();
    await initDatabase();
    console.log(`Produtos Service rodando na porta ${PORT} (PID: ${process.pid})`);
  });
}

module.exports = app;
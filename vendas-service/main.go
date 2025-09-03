// vendas-service/main.go
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	_ "github.com/go-sql-driver/mysql"
)

// Estruturas
type Venda struct {
	ID         int       `json:"id"`
	ClienteID  int       `json:"cliente_id"`
	ProdutoID  int       `json:"produto_id"`
	Quantidade int       `json:"quantidade"`
	ValorTotal float64   `json:"valor_total"`
	DataVenda  time.Time `json:"data_venda"`
}

type Produto struct {
	ID        int     `json:"id"`
	Nome      string  `json:"nome"`
	Descricao string  `json:"descricao"`
	Valor     float64 `json:"valor"`
}

type Cliente struct {
	ID       int    `json:"id"`
	Nome     string `json:"nome"`
	Telefone string `json:"telefone"`
}

type VendaCompleta struct {
	Venda   `json:",inline"`
	Cliente Cliente `json:"cliente"`
	Produto Produto `json:"produto"`
}

type VendaRequest struct {
	ClienteID  int `json:"cliente_id" binding:"required"`
	ProdutoID  int `json:"produto_id" binding:"required"`
	Quantidade int `json:"quantidade" binding:"required"`
}

// Variáveis globais
var (
	db          *sql.DB
	redisClient *redis.Client
	jobQueue    = make(chan VendaRequest, 100)
)

// Cache helpers
func getFromCache(key string) (string, error) {
	ctx := context.Background()
	return redisClient.Get(ctx, key).Result()
}

func setCache(key string, value interface{}, expiration time.Duration) error {
	ctx := context.Background()
	jsonData, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return redisClient.Set(ctx, key, jsonData, expiration).Err()
}

// Simulação de busca de cliente e produto
var clientes = map[int]Cliente{
	1: {ID: 1, Nome: "João", Telefone: "99999-0001"},
	2: {ID: 2, Nome: "Maria", Telefone: "99999-0002"},
}

var produtos = map[int]Produto{
	1: {ID: 1, Nome: "Produto A", Descricao: "Descrição A", Valor: 10.0},
	2: {ID: 2, Nome: "Produto B", Descricao: "Descrição B", Valor: 20.0},
}

func buscarCliente(clienteID int) (*Cliente, error) {
	c, ok := clientes[clienteID]
	if !ok {
		return nil, fmt.Errorf("cliente não encontrado")
	}
	return &c, nil
}

func buscarProduto(produtoID int) (*Produto, error) {
	p, ok := produtos[produtoID]
	if !ok {
		return nil, fmt.Errorf("produto não encontrado")
	}
	return &p, nil
}

// Processamento assíncrono
func processarVenda(vendaReq VendaRequest) {
	time.Sleep(200 * time.Millisecond) // simula processamento
	ctx := context.Background()

	evento := map[string]interface{}{
		"tipo":       "venda_processada",
		"cliente_id": vendaReq.ClienteID,
		"produto_id": vendaReq.ProdutoID,
		"timestamp":  time.Now(),
	}
	eventoJSON, _ := json.Marshal(evento)
	redisClient.Publish(ctx, "venda:processada", eventoJSON)

	log.Printf("Venda processada: Cliente %d, Produto %d", vendaReq.ClienteID, vendaReq.ProdutoID)
}

// Worker
func startWorker(id int, jobs <-chan VendaRequest) {
	go func() {
		for job := range jobs {
			log.Printf("Worker %d processando venda %v", id, job)
			processarVenda(job)
		}
	}()
}

// Handlers
func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "vendas"})
}

func listarVendas(c *gin.Context) {
	cached, err := getFromCache("vendas:all")
	if err == nil {
		var vendas []VendaCompleta
		if json.Unmarshal([]byte(cached), &vendas) == nil {
			c.JSON(http.StatusOK, gin.H{"data": vendas, "source": "cache"})
			return
		}
	}

	rows, err := db.Query("SELECT id, cliente_id, produto_id, quantidade, valor_total, data_venda FROM vendas ORDER BY data_venda DESC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar vendas"})
		return
	}
	defer rows.Close()

	var vendas []Venda
	for rows.Next() {
		var v Venda
		if err := rows.Scan(&v.ID, &v.ClienteID, &v.ProdutoID, &v.Quantidade, &v.ValorTotal, &v.DataVenda); err != nil {
			continue
		}
		vendas = append(vendas, v)
	}

	// Enriquecer com cliente/produto
	vendasCompletas := make([]VendaCompleta, len(vendas))
	var wg sync.WaitGroup
	for i, v := range vendas {
		wg.Add(1)
		go func(i int, v Venda) {
			defer wg.Done()
			vendasCompletas[i].Venda = v
			if c, err := buscarCliente(v.ClienteID); err == nil {
				vendasCompletas[i].Cliente = *c
			}
			if p, err := buscarProduto(v.ProdutoID); err == nil {
				vendasCompletas[i].Produto = *p
			}
		}(i, v)
	}
	wg.Wait()

	setCache("vendas:all", vendasCompletas, 5*time.Minute)
	c.JSON(http.StatusOK, gin.H{"data": vendasCompletas, "source": "database"})
}

func criarVenda(c *gin.Context) {
	var vendaReq VendaRequest
	if err := c.ShouldBindJSON(&vendaReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados inválidos"})
		return
	}

	cliente, err := buscarCliente(vendaReq.ClienteID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cliente não encontrado"})
		return
	}
	produto, err := buscarProduto(vendaReq.ProdutoID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Produto não encontrado"})
		return
	}

	valorTotal := produto.Valor * float64(vendaReq.Quantidade)

	result, err := db.Exec("INSERT INTO vendas (cliente_id, produto_id, quantidade, valor_total, data_venda) VALUES (?, ?, ?, ?, ?)",
		vendaReq.ClienteID, vendaReq.ProdutoID, vendaReq.Quantidade, valorTotal, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao criar venda"})
		return
	}

	id, _ := result.LastInsertId()
	venda := VendaCompleta{
		Venda: Venda{
			ID:         int(id),
			ClienteID:  vendaReq.ClienteID,
			ProdutoID:  vendaReq.ProdutoID,
			Quantidade: vendaReq.Quantidade,
			ValorTotal: valorTotal,
			DataVenda:  time.Now(),
		},
		Cliente: *cliente,
		Produto: *produto,
	}

	jobQueue <- vendaReq

	ctx := context.Background()
	redisClient.Del(ctx, "vendas:all")

	c.JSON(http.StatusCreated, gin.H{"data": venda})
}

// Inicializar banco
func inicializarBanco() error {
	query := `
	CREATE TABLE IF NOT EXISTS vendas (
		id INT AUTO_INCREMENT PRIMARY KEY,
		cliente_id INT NOT NULL,
		produto_id INT NOT NULL,
		quantidade INT NOT NULL,
		valor_total DECIMAL(10,2) NOT NULL,
		data_venda TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`
	_, err := db.Exec(query)
	return err
}

func main() {
	// Configuração MySQL (XAMPP)
	dsn := "root:@tcp(127.0.0.1:3306)/vendas_db?parseTime=true"
	var err error
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal("Erro MySQL:", err)
	}
	defer db.Close()

	if err := inicializarBanco(); err != nil {
		log.Fatal("Erro inicializar DB:", err)
	}

	// Configurar Redis
	redisClient = redis.NewClient(&redis.Options{
		Addr: "127.0.0.1:6379",
	})

	// Iniciar workers
	for i := 1; i <= 3; i++ {
		startWorker(i, jobQueue)
	}

	// Configurar Gin
	r := gin.Default()
	r.Use(cors.Default())

	r.GET("/health", healthCheck)
	r.GET("/vendas", listarVendas)
	r.POST("/vendas", criarVenda)

	log.Println("Vendas Service rodando em :8080")
	log.Fatal(r.Run(":8080"))
}

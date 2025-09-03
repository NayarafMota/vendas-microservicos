// frontend/src/components/SistemaVendas.js
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Users, Package, TrendingUp, Plus, List, RefreshCw } from 'lucide-react';

const API_ENDPOINTS = {
  produtos: process.env.REACT_APP_PRODUTOS_API || 'http://localhost:3001',
  clientes: process.env.REACT_APP_CLIENTES_API || 'http://localhost:3002', 
  vendas: process.env.REACT_APP_VENDAS_API || 'http://localhost:3003'
};

const SistemaVendas = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [produtos, setProdutos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(false);

  // Estados para formulários
  const [novoProduto, setNovoProduto] = useState({ nome: '', descricao: '', valor: '' });
  const [novoCliente, setNovoCliente] = useState({ nome: '', telefone: '' });
  const [novaVenda, setNovaVenda] = useState({ cliente_id: '', produto_id: '', quantidade: '' });

  // Função para fazer requisições HTTP
  const fetchData = async (endpoint, service) => {
    try {
      const response = await fetch(`${API_ENDPOINTS[service]}/${endpoint}`);
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error(`Erro ao buscar ${endpoint}:`, error);
      return [];
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    if (activeTab === 'dashboard' || activeTab === 'vendas') {
      loadAllData();
    } else if (activeTab === 'produtos') {
      loadProdutos();
    } else if (activeTab === 'clientes') {
      loadClientes();
    }
  }, [activeTab]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [produtosData, clientesData, vendasData] = await Promise.all([
        fetchData('produtos', 'produtos'),
        fetchData('clientes', 'clientes'),
        fetchData('vendas', 'vendas')
      ]);
      setProdutos(produtosData);
      setClientes(clientesData);
      setVendas(vendasData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
    setLoading(false);
  };

  const loadProdutos = async () => {
    const data = await fetchData('produtos', 'produtos');
    setProdutos(data);
  };

  const loadClientes = async () => {
    const data = await fetchData('clientes', 'clientes');
    setClientes(data);
  };

  // Função para criar produto
  const criarProduto = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_ENDPOINTS.produtos}/produtos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...novoProduto,
          valor: parseFloat(novoProduto.valor)
        })
      });

      if (response.ok) {
        setNovoProduto({ nome: '', descricao: '', valor: '' });
        loadProdutos();
        alert('Produto cadastrado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao criar produto:', error);
      alert('Erro ao cadastrar produto');
    }
  };

  // Função para criar cliente
  const criarCliente = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_ENDPOINTS.clientes}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoCliente)
      });

      if (response.ok) {
        setNovoCliente({ nome: '', telefone: '' });
        loadClientes();
        alert('Cliente cadastrado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      alert('Erro ao cadastrar cliente');
    }
  };

  // Função para criar venda
  const criarVenda = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_ENDPOINTS.vendas}/vendas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...novaVenda,
          cliente_id: parseInt(novaVenda.cliente_id),
          produto_id: parseInt(novaVenda.produto_id),
          quantidade: parseInt(novaVenda.quantidade)
        })
      });

      if (response.ok) {
        setNovaVenda({ cliente_id: '', produto_id: '', quantidade: '' });
        loadAllData();
        alert('Venda realizada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao criar venda:', error);
      alert('Erro ao realizar venda');
    }
  };

  // Componente Dashboard
  const Dashboard = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <button
          onClick={loadAllData}
          disabled={loading}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Produtos</p>
              <p className="text-2xl font-semibold text-gray-900">{produtos.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Clientes</p>
              <p className="text-2xl font-semibold text-gray-900">{clientes.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Vendas</p>
              <p className="text-2xl font-semibold text-gray-900">{vendas.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Vendas recentes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Vendas Recentes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vendas.slice(0, 5).map((venda) => (
                <tr key={venda.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {venda.cliente?.nome || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {venda.produto?.nome || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {venda.quantidade}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    R$ {venda.valor_total?.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Componente Produtos
  const Produtos = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Produtos</h2>
      </div>

      {/* Formulário de cadastro */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cadastrar Novo Produto</h3>
        <form onSubmit={criarProduto} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Nome do produto"
            value={novoProduto.nome}
            onChange={(e) => setNovoProduto({ ...novoProduto, nome: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <input
            type="text"
            placeholder="Descrição"
            value={novoProduto.descricao}
            onChange={(e) => setNovoProduto({ ...novoProduto, descricao: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex space-x-2">
            <input
              type="number"
              step="0.01"
              placeholder="Valor"
              value={novoProduto.valor}
              onChange={(e) => setNovoProduto({ ...novoProduto, valor: e.target.value })}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar</span>
            </button>
          </div>
        </form>
      </div>

      {/* Lista de produtos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Lista de Produtos</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {produtos.map((produto) => (
            <div key={produto.id} className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900">{produto.nome}</h4>
              <p className="text-gray-600 text-sm mt-1">{produto.descricao}</p>
              <p className="text-lg font-bold text-blue-600 mt-2">
                R$ {produto.valor?.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Componente Clientes
  const Clientes = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
      </div>

      {/* Formulário de cadastro */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cadastrar Novo Cliente</h3>
        <form onSubmit={criarCliente} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Nome do cliente"
            value={novoCliente.nome}
            onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <input
            type="tel"
            placeholder="Telefone"
            value={novoCliente.telefone}
            onChange={(e) => setNovoCliente({ ...novoCliente, telefone: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <button
            type="submit"
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar</span>
          </button>
        </form>
      </div>

      {/* Lista de clientes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Lista de Clientes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Cadastro</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clientes.map((cliente) => (
                <tr key={cliente.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {cliente.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {cliente.nome}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {cliente.telefone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {cliente.created_at ? new Date(cliente.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Componente Vendas
  const Vendas = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Vendas</h2>
      </div>

      {/* Formulário de nova venda */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Realizar Nova Venda</h3>
        <form onSubmit={criarVenda} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={novaVenda.cliente_id}
            onChange={(e) => setNovaVenda({ ...novaVenda, cliente_id: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Selecione um cliente</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>

          <select
            value={novaVenda.produto_id}
            onChange={(e) => setNovaVenda({ ...novaVenda, produto_id: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Selecione um produto</option>
            {produtos.map((produto) => (
              <option key={produto.id} value={produto.id}>
                {produto.nome} - R$ {produto.valor?.toFixed(2)}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="1"
            placeholder="Quantidade"
            value={novaVenda.quantidade}
            onChange={(e) => setNovaVenda({ ...novaVenda, quantidade: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />

          <button
            type="submit"
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 flex items-center justify-center space-x-2"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Realizar Venda</span>
          </button>
        </form>
      </div>

      {/* Lista de vendas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Histórico de Vendas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vendas.map((venda) => (
                <tr key={venda.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {venda.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {venda.cliente?.nome || 'Cliente não encontrado'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {venda.produto?.nome || 'Produto não encontrado'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {venda.quantidade}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                    R$ {venda.valor_total?.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(venda.data_venda).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <ShoppingCart className="w-8 h-8 text-blue-600" />
              <h1 className="ml-3 text-2xl font-bold text-gray-900">Sistema de Vendas</h1>
            </div>
            <div className="text-sm text-gray-500">
              Microserviços: Node.js • Python • Go • React
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'dashboard', name: 'Dashboard', icon: TrendingUp },
              { id: 'produtos', name: 'Produtos', icon: Package },
              { id: 'clientes', name: 'Clientes', icon: Users },
              { id: 'vendas', name: 'Vendas', icon: ShoppingCart }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Carregando...</span>
            </div>
          )}

          {!loading && (
            <>
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'produtos' && <Produtos />}
              {activeTab === 'clientes' && <Clientes />}
              {activeTab === 'vendas' && <Vendas />}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Sistema Distribuído com Microserviços
            </div>
            <div className="flex space-x-4 text-xs text-gray-400">
              <span>Produtos: Node.js + PostgreSQL</span>
              <span>Clientes: Python + MongoDB</span>
              <span>Vendas: Go + MySQL</span>
              <span>Cache: Redis</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default SistemaVendas;
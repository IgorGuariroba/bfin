#!/bin/bash

# BFIN - Script de inicialização simplificado
# Este script automatiza a inicialização completa do ambiente

set -e  # Para a execução se houver erro

echo "🚀 BFIN - Iniciando ambiente de desenvolvimento..."
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Subir infraestrutura (Docker)
echo -e "${BLUE}[1/6] Subindo infraestrutura (PostgreSQL, Redis, Adminer)...${NC}"
docker-compose up -d

# Aguardar PostgreSQL estar pronto
echo -e "${YELLOW}Aguardando PostgreSQL estar pronto...${NC}"
sleep 5

# 2. Backend - Instalar dependências
echo -e "${BLUE}[2/6] Instalando dependências do backend...${NC}"
cd backend
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "Dependências já instaladas, pulando..."
fi

# 3. Verificar arquivo .env
echo -e "${BLUE}[3/6] Verificando configuração do backend...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Arquivo .env não encontrado. Criando a partir do .env.example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ Arquivo .env criado. Verifique as configurações se necessário.${NC}"
    else
        echo -e "${YELLOW}⚠ Arquivo .env.example não encontrado. Crie o .env manualmente.${NC}"
    fi
fi

# 4. Executar migrations e seed
echo -e "${BLUE}[4/6] Executando migrations do banco de dados...${NC}"
npm run db:generate
npm run db:migrate

echo -e "${BLUE}[5/6] Populando banco com dados iniciais (seed)...${NC}"
npm run db:seed || echo -e "${YELLOW}⚠ Seed já foi executado ou falhou${NC}"

# 5. Iniciar backend em background
echo -e "${BLUE}[6/6] Iniciando servidor backend...${NC}"
npm run dev &
BACKEND_PID=$!

# Voltar para raiz
cd ..

# 6. Frontend - Instalar e iniciar
echo -e "${BLUE}Instalando dependências do frontend...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "Dependências já instaladas, pulando..."
fi

echo -e "${BLUE}Iniciando servidor frontend...${NC}"
npm run dev &
FRONTEND_PID=$!

# Voltar para raiz
cd ..

echo ""
echo -e "${GREEN}✅ Ambiente iniciado com sucesso!${NC}"
echo ""
echo -e "${GREEN}Serviços disponíveis:${NC}"
echo "  📊 Frontend:  http://localhost:5173"
echo "  🔧 Backend:   http://localhost:3000"
echo "  🗄️  Adminer:   http://localhost:8080"
echo "     └─ Sistema: PostgreSQL"
echo "     └─ Servidor: postgres"
echo "     └─ Usuário: bfin_user"
echo "     └─ Senha: bfin_pass"
echo "     └─ Base: bfin_dev"
echo ""
echo -e "${YELLOW}Para parar os serviços, execute:${NC}"
echo "  ./stop.sh"
echo ""
echo -e "${YELLOW}PIDs dos processos:${NC}"
echo "  Backend: $BACKEND_PID"
echo "  Frontend: $FRONTEND_PID"
echo ""

# Manter o script rodando
wait

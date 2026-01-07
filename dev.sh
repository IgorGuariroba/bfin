#!/bin/bash

# BFIN - Script de desenvolvimento rápido
# Para quando você já rodou start.sh antes e só quer reiniciar os servidores

set -e

echo "🔧 BFIN - Modo desenvolvimento rápido"
echo ""

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Verificar se Docker está rodando
if ! docker-compose ps | grep -q "Up"; then
    echo -e "${BLUE}Iniciando containers Docker...${NC}"
    docker-compose up -d
    sleep 3
fi

# Iniciar backend
echo -e "${BLUE}Iniciando backend...${NC}"
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Iniciar frontend
echo -e "${BLUE}Iniciando frontend...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}✅ Serviços iniciados!${NC}"
echo ""
echo "  📊 Frontend:  http://localhost:5173"
echo "  🔧 Backend:   http://localhost:3000"
echo "  🗄️  Adminer:   http://localhost:8080"
echo ""
echo "Para parar: ./stop.sh"
echo ""

wait

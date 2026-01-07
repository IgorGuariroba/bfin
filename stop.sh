#!/bin/bash

# BFIN - Script para parar todos os serviços

echo "🛑 Parando serviços BFIN..."

# Parar processos Node
echo "Parando backend e frontend..."
killall -9 node 2>/dev/null || echo "Nenhum processo Node rodando"

# Parar containers Docker
echo "Parando containers Docker..."
docker-compose down

echo ""
echo "✅ Todos os serviços foram parados!"

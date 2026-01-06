# Getting Started - BFIN

> Guia rápido para iniciar o desenvolvimento do projeto BFIN

---

## Pré-requisitos

Certifique-se de ter instalado:

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **Docker** e **Docker Compose** ([Download](https://www.docker.com/))
- **Git** ([Download](https://git-scm.com/))

Verifique as versões:

```bash
node --version  # v20.x.x ou superior
npm --version   # v10.x.x ou superior
docker --version
docker-compose --version
```

---

## Passo a Passo

### 1. Clonar o Repositório

```bash
git clone https://github.com/seu-usuario/bfin.git
cd bfin
```

### 2. Subir Infraestrutura (PostgreSQL + Redis)

```bash
docker-compose up -d
```

Isso iniciará:
- **PostgreSQL** na porta `5432`
- **Redis** na porta `6379`
- **Adminer** (UI do PostgreSQL) na porta `8080`

Verificar se está rodando:
```bash
docker-compose ps
```

Acessar Adminer (UI do banco):
- URL: `http://localhost:8080`
- System: **PostgreSQL**
- Server: **postgres**
- Username: **bfin_user**
- Password: **bfin_pass**
- Database: **bfin_dev**

### 3. Configurar Backend

```bash
cd backend
npm install
```

O arquivo `.env` já foi criado com as configurações de desenvolvimento.

#### 3.1 Gerar Prisma Client

```bash
npm run db:generate
```

#### 3.2 Executar Migrations

```bash
npm run db:migrate
```

Isso criará todas as tabelas no banco de dados.

#### 3.3 Popular Banco com Dados Iniciais (Seed)

```bash
npm run db:seed
```

Isso criará as categorias padrão (Salário, Alimentação, etc).

#### 3.4 Iniciar Servidor de Desenvolvimento

```bash
npm run dev
```

O backend estará rodando em: `http://localhost:3000`

Verifique a saúde do servidor:
```bash
curl http://localhost:3000/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2026-01-06T...",
  "uptime": 5.234
}
```

### 4. Configurar Frontend

Abra um **novo terminal** e execute:

```bash
cd frontend
npm install
npm run dev
```

O frontend estará rodando em: `http://localhost:5173`

Abra no navegador e você verá a tela inicial do BFIN.

---

## Estrutura de Desenvolvimento

Quando tudo estiver rodando, você terá:

| Serviço | URL | Descrição |
|---------|-----|-----------|
| **Frontend** | http://localhost:5173 | Interface React |
| **Backend API** | http://localhost:3000 | API REST |
| **Health Check** | http://localhost:3000/health | Status do servidor |
| **Adminer** | http://localhost:8080 | UI do PostgreSQL |
| **PostgreSQL** | localhost:5432 | Banco de dados |
| **Redis** | localhost:6379 | Cache |

---

## Comandos Úteis

### Backend

```bash
# Desenvolvimento (watch mode)
npm run dev

# Build para produção
npm run build
npm run start

# Prisma Studio (GUI do banco)
npm run db:studio

# Resetar banco (CUIDADO: apaga tudo)
npm run db:reset

# Rodar testes
npm run test
npm run test:coverage

# Executar cron job manualmente
npm run cron:execute-expenses
```

### Frontend

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build
npm run preview

# Linter
npm run lint
```

### Docker

```bash
# Ver logs
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f postgres

# Parar serviços
docker-compose down

# Parar e remover volumes (apaga dados do banco)
docker-compose down -v

# Recriar containers
docker-compose up -d --build --force-recreate
```

---

## Troubleshooting

### Erro: "Cannot connect to database"

Verifique se o PostgreSQL está rodando:
```bash
docker-compose ps
```

Se não estiver, inicie:
```bash
docker-compose up -d postgres
```

### Erro: "Port 5432 already in use"

Você tem outro PostgreSQL rodando localmente. Opções:

1. **Parar o PostgreSQL local:**
   ```bash
   sudo service postgresql stop  # Linux
   brew services stop postgresql # macOS
   ```

2. **Mudar a porta no docker-compose.yml:**
   ```yaml
   ports:
     - "5433:5432"  # Usar porta 5433 ao invés de 5432
   ```

   E atualizar o `.env`:
   ```
   DATABASE_URL="postgresql://bfin_user:bfin_pass@localhost:5433/bfin_dev"
   ```

### Erro: "Prisma Client is not generated"

Execute:
```bash
cd backend
npm run db:generate
```

### Erro de CORS no frontend

Certifique-se que o backend está rodando na porta `3000` e o frontend na `5173`.

O Vite já está configurado para fazer proxy das requisições `/api/*` para o backend.

---

## Próximos Passos

Agora que o ambiente está configurado, você pode:

1. **Explorar a documentação:**
   - [ESPECIFICACAO_TECNICA.md](./ESPECIFICACAO_TECNICA.md) - Visão completa do sistema
   - [EXEMPLOS_IMPLEMENTACAO.md](./EXEMPLOS_IMPLEMENTACAO.md) - Código de referência
   - [FASE_1_MVP.md](./FASE_1_MVP.md) - Roadmap detalhado

2. **Começar a desenvolver:**
   - Implementar sistema de autenticação (Semana 2)
   - Criar CRUD de contas (Semana 2)
   - Implementar transações (Semana 3-5)

3. **Acessar o Prisma Studio:**
   ```bash
   cd backend
   npm run db:studio
   ```
   Abra `http://localhost:5555` para visualizar e editar dados do banco.

---

## Estrutura de Arquivos Importantes

```
bfin/
├── backend/
│   ├── src/
│   │   ├── server.ts           # Ponto de entrada
│   │   ├── controllers/        # Controladores (futuro)
│   │   ├── services/           # Lógica de negócio (futuro)
│   │   ├── middlewares/        # Middlewares (auth, error, etc)
│   │   └── routes/             # Rotas da API (futuro)
│   ├── prisma/
│   │   ├── schema.prisma       # Modelo de dados
│   │   ├── seed.ts             # Dados iniciais
│   │   └── migrations/         # Migrations do banco
│   ├── .env                    # Variáveis de ambiente
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Componente raiz
│   │   ├── main.tsx            # Ponto de entrada
│   │   ├── components/         # Componentes React (futuro)
│   │   ├── pages/              # Páginas (futuro)
│   │   └── services/           # API client (futuro)
│   └── package.json
│
├── docker-compose.yml          # Infraestrutura
├── README.md                   # Visão geral
├── GETTING_STARTED.md          # Este arquivo
├── ESPECIFICACAO_TECNICA.md    # Documentação completa
└── FASE_1_MVP.md               # Roadmap do MVP
```

---

## Contribuindo

Antes de criar um PR:

1. Execute os testes:
   ```bash
   npm run test
   ```

2. Verifique o linter:
   ```bash
   npm run lint
   ```

3. Certifique-se que o build funciona:
   ```bash
   npm run build
   ```

---

**Bom desenvolvimento! 🚀**

Se encontrar problemas, verifique as issues no GitHub ou abra uma nova.

## 1. Dependências

- [x] 1.1 Adicionar `clinic` (meta-pacote com doctor, bubbleprof, heapprofiler) como devDependency no `package.json`
- [x] 1.2 Adicionar `.clinic/` ao `.gitignore`

## 2. Dockerfile e Compose

- [x] 2.1 Adicionar estágio `profile` no `Dockerfile` que instala devDependencies (incluindo Clinic.js)
- [x] 2.2 Criar `docker-compose.profile.yml` com override do comando do app para rodar via Clinic.js e volume bind de `.clinic/`

## 3. Scripts npm

- [x] 3.1 Adicionar script `profile:doctor` no `package.json` que inicia o compose com `CLINIC_TOOL=doctor`
- [x] 3.2 Adicionar script `profile:bubbleprof` no `package.json` que inicia o compose com `CLINIC_TOOL=bubbleprof`
- [x] 3.3 Adicionar script `profile:heap` no `package.json` que inicia o compose com `CLINIC_TOOL=heapprofiler`

## 4. Validação

- [x] 4.1 Executar `npm run profile:doctor` e verificar se o relatório HTML é gerado em `.clinic/`
- [x] 4.2 Verificar se o `.clinic/` está ignorado pelo git

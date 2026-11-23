# API de contas do GameWeb

API Node.js 24 + Fastify + PostgreSQL. O frontend continua no [GitHub Pages](https://heitormtsantos.github.io/GameWeb/). A API deve ser hospedada na sua VPS e ter um domínio HTTPS próprio.

## Subir na VPS com Docker

Pré-requisitos: Linux, Docker Engine com Compose, domínio apontando para o IP da VPS. Recomenda-se pelo menos 2 GB de RAM para API, banco e sistema operacional.

```sh
git clone https://github.com/heitormtsantos/GameWeb.git
cd GameWeb/backend
cp .env.example .env
```

Gere **duas senhas diferentes**, uma para o administrador do banco e outra para a aplicação:

```sh
openssl rand -hex 32
openssl rand -hex 32
```

Preencha `.env` com esses valores em `POSTGRES_ADMIN_PASSWORD` e `POSTGRES_PASSWORD`. Defina também:

```dotenv
ALLOWED_ORIGINS=https://heitormtsantos.github.io
API_DOMAIN=api.seudominio.com
API_PORT=3000
```

`ALLOWED_ORIGINS` recebe origens completas, separadas por vírgula, **sem `/GameWeb/` ou barra final**. Nunca use `*`. `API_DOMAIN` deve ser o seu domínio real, com DNS apontando para a VPS. Não envie `.env` ao GitHub.

Para banco e API, usando um proxy HTTPS que você já tenha:

```sh
docker compose up -d --build db api
docker compose ps
curl http://127.0.0.1:3000/health
```

A porta da API é publicada somente em `127.0.0.1`. Configure seu proxy para encaminhar o domínio HTTPS para `http://127.0.0.1:3000`. O banco não expõe a porta 5432 ao host.

Se a VPS ainda não tiver proxy, o perfil opcional com Caddy configura HTTPS:

```sh
docker compose --profile https up -d --build
curl https://api.seudominio.com/health
```

As portas 80 e 443 precisam estar livres e acessíveis. Não habilite esse perfil em paralelo com outro proxy usando essas mesmas portas.

No primeiro início, o PostgreSQL cria um usuário `gameweb` sem privilégios de superusuário. O administrador do banco e a API usam credenciais diferentes. As migrações são aplicadas em transação antes de a API aceitar conexões. O volume `db-data` preserva contas e saves entre reinícios e novas imagens.

## Ativar contas no site

Depois que `/health` responder pelo domínio HTTPS da VPS:

1. No GitHub, abra **Settings → Secrets and variables → Actions → Variables** do GameWeb.
2. Crie a variável de repositório **`GAMEWEB_API_URL`**, por exemplo `https://api.seudominio.com`, sem caminho ou barra final.
3. Em **Actions → Verify and publish game**, execute **Run workflow** na branch `main`.

Essa variável é pública: contém somente a origem da API, sem senha, token ou credencial. O build injeta o mesmo endereço no site e no HTML único. Nunca coloque `DATABASE_URL`, senha do banco ou token de conta nessa variável.

Enquanto `GAMEWEB_API_URL` estiver vazia, o site informa que as contas não estão disponíveis e mantém o jogo como visitante. Nenhuma chamada de login é enviada.

Para testar localmente com o frontend servido em `http://localhost:8000`, adicione essa origem a `ALLOWED_ORIGINS` e gere o site com `GAMEWEB_API_URL=http://localhost:3000`. HTTP é aceito apenas para desenvolvimento em loopback; use HTTPS para o domínio público.

## Operação

Atualizar a versão, preservando o volume:

```sh
git pull --ff-only
docker compose up -d --build db api
docker compose logs --tail 100 api
```

Para usar o Caddy, mantenha `--profile https` no comando `up`. Se você usa Nginx ou outro proxy, configure-o para substituir corretamente os cabeçalhos de origem do cliente. A API confia em apenas um salto de proxy e fica vinculada ao loopback do host.

Backup manual com permissões restritas:

```sh
umask 077
mkdir -p backups
docker compose exec -T db pg_dump -U gameweb -d gameweb -Fc > backups/gameweb.dump
```

Guarde o backup fora da VPS. Ele contém e-mails, hashes de senhas, sessões e progresso. Para restaurar, pare a API e use um backup verificado; a opção `--clean` abaixo substitui os dados atuais:

```sh
docker compose stop api
docker compose exec -T db pg_restore --clean --if-exists --no-owner -U gameweb -d gameweb < backups/gameweb.dump
docker compose up -d api
```

Não execute `docker compose down --volumes` na VPS se quiser preservar os dados. Esse comando remove os volumes do projeto. Alterar as senhas no `.env` não altera automaticamente senhas de um banco já inicializado.

## Recuperar uma senha administrativamente

A conta autenticada pode alterar a senha pelo perfil. Esta versão não envia e-mail de recuperação ou de verificação. Se o jogador perdeu a senha, o administrador precisa confirmar a identidade por um canal próprio antes de executar a recuperação.

Em um terminal Bash confiável, leia a nova senha sem exibi-la e envie-a por stdin:

```sh
read -r -s -p 'Nova senha: ' gameweb_new_password
printf '\n'
printf '%s\n' "$gameweb_new_password" | docker compose exec -T api npm run reset-password -- jogador@exemplo.com
unset gameweb_new_password
```

Use de 12 a 128 caracteres. Não passe a senha como argumento, não use `set -x` e não coloque senhas no histórico. O comando encerra todas as sessões dessa conta. O e-mail não é prova de identidade verificada nesta versão.

## API

| Método e rota            | Função                                                                    |
| ------------------------ | ------------------------------------------------------------------------- |
| `GET /health`            | Verifica serviço e conexão com o banco                                    |
| `POST /v1/auth/register` | `{ email, password, nickname, remember? }`                                |
| `POST /v1/auth/login`    | `{ email, password, remember? }`                                          |
| `POST /v1/auth/logout`   | Revoga a sessão atual                                                     |
| `GET /v1/me`             | Perfil e progresso do usuário autenticado                                 |
| `PATCH /v1/me/profile`   | Edita `{ nickname }`                                                      |
| `POST /v1/me/password`   | `{ currentPassword, newPassword }`; gira a sessão e encerra as anteriores |
| `PUT /v1/me/progress`    | `{ baseRevision, mutationId, data }`                                      |

Rotas protegidas usam `Authorization: Bearer <token>`. Tokens são aleatórios, têm hash no banco, podem ser revogados e expiram em 12 horas ou em 7 dias quando o jogador escolhe manter a sessão. A aplicação não usa cookies de terceiros. O navegador guarda a sessão na aba; a opção de manter conectado usa armazenamento persistente.

O contrato de `data` está em [`../save-model.js`](../save-model.js). Somente aparência, configurações, teclas e estatísticas casuais são aceitas. Campos extras e valores inconsistentes são rejeitados. Senhas usam scrypt com salt aleatório; o processamento tem concorrência limitada. Há limite de requisições, CORS explícito e respostas privadas sem cache.

Writes de progresso usam revisão otimista e `mutationId` UUID v4. Repetir a mesma operação não a aplica duas vezes. Conflitos retornam `409 PROGRESS_CONFLICT` com a versão online. Uma resposta idempotente pode incluir `current` se outro dispositivo já publicou uma versão mais recente. Os últimos 100 identificadores de operação por usuário são preservados para repetição segura.

O cliente mantém dados de visitante e de cada conta separados. A importação é explícita e só aparece para contas vazias. Alterações offline ficam pendentes; conflitos exigem escolher a versão. Como as estatísticas são enviadas pelo próprio jogo, isso **não é um backend competitivo nem um sistema antitrapaça**.

## Desenvolvimento e testes

Na raiz do repositório:

```sh
npm ci
npm ci --prefix backend
npm test
```

Os testes da API usam PostgreSQL embarcado via PGlite e as mesmas migrações/consultas. Os testes de contas no navegador exercitam a API HTTP real, duas contas/dispositivos, offline, recarga, resposta perdida, conflitos e revogação de sessões. O CI também monta os containers de API e PostgreSQL e verifica cadastro, save e logout antes de liberar o deploy do frontend.

Sem Docker, o servidor aceita as variáveis padrão `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, ou `DATABASE_URL`. Exporte-as no processo antes de executar `npm start --prefix backend`. Não são lidas do navegador.

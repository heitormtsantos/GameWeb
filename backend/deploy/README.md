# GameWeb na VPS

API: **https://gameweb.76.13.114.33.sslip.io**. Healthcheck: [`/health`](https://gameweb.76.13.114.33.sslip.io/health).

Esta instalação usa serviços nativos separados para preservar os projetos existentes. Não foi instalado Docker nem alterado o Node global. O Nginx recebeu somente um novo virtual host; os arquivos e serviços dos outros projetos foram preservados.

| Item                    | Local ou configuração                                        |
| ----------------------- | ------------------------------------------------------------ |
| Código                  | `/opt/gameweb/app`                                           |
| Node 24 privado         | `/opt/gameweb/runtime/current/bin/node`                      |
| API                     | `gameweb-api.service`, usuário `gameweb`, `127.0.0.1:4185`   |
| Banco próprio           | `gameweb-postgres.service`, PostgreSQL 16, `127.0.0.1:15432` |
| Dados do banco          | `/var/lib/gameweb-postgres`, usuário `gameweb-db`            |
| Socket privado do banco | `/run/gameweb-postgres`                                      |
| Credenciais e ambiente  | `/etc/gameweb/backend.env`, somente root pode ler            |
| Proxy                   | `/etc/nginx/sites-available/gameweb-api`                     |
| Certificado HTTPS       | `/etc/letsencrypt/live/gameweb-api/`                         |
| Backups locais          | `/var/backups/gameweb`, retenção de 14 dias                  |

API e banco iniciam com o sistema. A API usa um usuário de banco sem privilégios de superusuário; o PostgreSQL principal da VPS não recebe tabelas, contas ou alterações do GameWeb. As portas 4185 e 15432 ficam restritas ao loopback. O certificado foi emitido pelo Certbot com desafio webroot em `/var/www/gameweb-acme`; a renovação usa o timer existente e um hook específico para o certificado do GameWeb.

O hostname provisório pode ser trocado por um domínio próprio posteriormente. Para mudar o endereço do frontend, ajuste a variável pública de repositório `GAMEWEB_API_URL` e execute o workflow do Pages. A origem permitida no backend é `https://heitormtsantos.github.io`, sem `/GameWeb/`.

## Verificar e atualizar

Na VPS, como root:

```sh
systemctl status gameweb-api gameweb-postgres --no-pager
curl -fsS https://gameweb.76.13.114.33.sslip.io/health
journalctl -u gameweb-api -n 50 --no-pager
```

Para atualizar somente o GameWeb:

```sh
cd /opt/gameweb/app
git pull --ff-only
PATH=/opt/gameweb/runtime/current/bin:$PATH /opt/gameweb/runtime/current/bin/npm ci --prefix backend --omit=dev --ignore-scripts --no-audit --no-fund --cache /opt/gameweb/npm-cache
systemctl restart gameweb-api
curl -fsS https://gameweb.76.13.114.33.sslip.io/health
```

As migrações rodam automaticamente antes de a API aceitar conexões. Não reinicie PostgreSQL, PM2 ou outros serviços para atualizar o GameWeb. Os arquivos `.service` e `nginx-gameweb.conf` desta pasta são cópias de referência da configuração implantada; uma atualização de código não os instala automaticamente.

## Backup e restauração

`gameweb-backup.timer` executa um backup diário às 03:20 UTC, com atraso aleatório de até dez minutos. Os arquivos são privados, no formato custom do PostgreSQL, e mantidos por 14 dias. A primeira execução foi validada com restauração em um banco temporário do próprio GameWeb, removido após a conferência. A cópia externa à VPS ainda precisa ser organizada pelo administrador.

Para gerar e consultar um backup:

```sh
systemctl start gameweb-backup
systemctl status gameweb-backup.timer --no-pager
ls -lh /var/backups/gameweb
```

Restaure somente um backup verificado. O comando abaixo substitui os dados atuais **do banco GameWeb**, mantendo os demais bancos da VPS fora da operação. Substitua o nome do arquivo antes de executar:

```sh
systemctl stop gameweb-api
runuser -u gameweb-db -- /usr/lib/postgresql/16/bin/pg_restore -h /run/gameweb-postgres -p 15432 -U gameweb-db -d gameweb --role=gameweb --clean --if-exists --no-owner /var/backups/gameweb/gameweb-AAAAMMDDTHHMMSSZ.dump
systemctl start gameweb-api
```

## Recuperação administrativa de senha

Depois de confirmar a identidade do jogador, leia a nova senha sem exibir no terminal e envie-a por stdin. Este comando carrega o ambiente privado pelo systemd; não copia credenciais do banco para o histórico:

```sh
read -r -s -p 'Nova senha: ' gameweb_new_password
printf '\n'
printf '%s\n' "$gameweb_new_password" | systemd-run --quiet --pipe --wait --collect --unit=gameweb-password-reset --property=User=gameweb --property=EnvironmentFile=/etc/gameweb/backend.env --working-directory=/opt/gameweb/app/backend /opt/gameweb/runtime/current/bin/node scripts/reset-password.js jogador@exemplo.com
unset gameweb_new_password
```

A senha deve ter de 12 a 128 caracteres. A operação encerra todas as sessões da conta. Esta versão não envia e-mails de recuperação ou verificação, e os resultados de partida continuam casuais.

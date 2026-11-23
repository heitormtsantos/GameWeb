#!/bin/sh
(
set -eu
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<'SQL'
\getenv app_password GAMEWEB_DB_PASSWORD
CREATE ROLE gameweb LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
SELECT format('ALTER ROLE gameweb PASSWORD %L', :'app_password') \gexec
ALTER DATABASE gameweb OWNER TO gameweb;
GRANT ALL ON SCHEMA public TO gameweb;
SQL
)

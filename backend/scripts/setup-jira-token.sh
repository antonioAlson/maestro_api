#!/bin/bash

# Script para configurar token do Jira para usuário na VPS
# Uso: ./setup-jira-token.sh "email@dominio.com" "TOKEN_DO_JIRA"

EMAIL=$1
TOKEN=$2

if [ -z "$EMAIL" ] || [ -z "$TOKEN" ]; then
    echo "❌ Uso: ./setup-jira-token.sh \"email@dominio.com\" \"TOKEN_DO_JIRA\""
    exit 1
fi

echo "🔧 Configurando token do Jira para: $EMAIL"

# Conectar ao banco e executar UPDATE
PGPASSWORD='.&}}<N$q8N4:65yzDfy54^+,h+s/"E0vzQnaS' psql \
    -h 46.202.92.228 \
    -p 5432 \
    -U caio \
    -d opera \
    -c "UPDATE maestro.users SET api_token = '$TOKEN' WHERE email = '$EMAIL';" \
    -c "SELECT id, name, email, CASE WHEN api_token IS NOT NULL THEN '✓ Configurado' ELSE '✗ Não configurado' END as status FROM maestro.users WHERE email = '$EMAIL';"

if [ $? -eq 0 ]; then
    echo "✅ Token configurado com sucesso!"
else
    echo "❌ Erro ao configurar token"
    exit 1
fi

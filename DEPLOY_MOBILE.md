# Deploy do mobile online

Este deploy publica o `app.py` como API/web app online e continua usando o Supabase como banco.

## Render

1. Suba este projeto para um repositorio privado no GitHub.
2. No Render, crie um novo Blueprint ou Web Service usando o arquivo `render.yaml`.
3. Configure as variaveis secretas do banco:

```text
DB_HOST
DB_USER
DB_PASSWORD
DB_PORT=5432
DB_NAME=postgres
```

Use os dados do Session Pooler do Supabase quando o deploy for no Render.

4. Depois do deploy, abra:

```text
https://SEU-SERVICO.onrender.com/mobile
```

## Observacoes

- O plano gratuito pode dormir apos um periodo sem uso; o primeiro acesso depois disso demora mais.
- Nao envie `db_config.local.json` para o GitHub. Ele ja esta no `.gitignore`.
- Nao coloque senha do banco no `mobile.html` ou no JavaScript. As credenciais ficam somente no servidor hospedado.

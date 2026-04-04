# Whitelist Implementation Guide - V1

## ✅ IMPLEMENTADO

### Backend Changes
- ✅ **Signup API** - Validação de whitelist antes de criar conta
  - Email não na whitelist → Erro 403 + link Manual de Donos
  - Email inativo → Erro 403 + mensagem de contato
  - Email ativo → Conta criada normalmente

- ✅ **Login API** - Bloqueio de contas inativas
  - Mesmo com senha correta, inativo → Erro 403
  - Prevent brute force bypass tentando logar com conta inativa

### Frontend Changes
- ✅ **Error States** - Nova UI para mensagens de erro
  - Mostra erro principal
  - Mostra detalhes (se houver)
  - Link clicável para Manual de Donos
  - Cleanup de erro ao trocar email/tab

### Database Schema
- ✅ **SQL Migration** - `docs/WHITELIST_SETUP.sql`

---

## 🚀 PRÓXIMOS PASSOS

### 1. Execute a SQL Migration (5 min)
1. Abra Supabase Dashboard
2. SQL Editor → New Query
3. Cole conteúdo de `docs/WHITELIST_SETUP.sql`
4. Clique "Run"
5. Resultado: Tabela `authorized_users` criada com índices

### 2. Importar Dados de Whitelist (10 min)
Você tem 2 opções:

**Opção A: Manual (UI Supabase)**
1. Supabase Dashboard → authorized_users table
2. Insert row
3. Email, status='active'
4. Repetir para cada usuário

**Opção B: CSV Import (Melhor)**
1. Prepare um CSV com colunas:
   ```
   email,status,first_name,last_name
   bruno@example.com,active,Bruno,Amaral
   user2@example.com,inactive,John,Doe
   ```
2. Supabase Dashboard → authorized_users
3. Import data → Upload CSV
4. Map columns → Run

**Opção C: API Script (Para Integração)**
```bash
# Criar um script que importa dados via API
# Veremos isso se precisar integração com sistema externo
```

### 3. Testar Whitelist (10 min)

#### Teste 1: Email não na whitelist
1. Signup com email NÃO autorizado
2. Esperado: ❌ "Você não tem autorização."
   - Link "Entre em contato com Manual de Donos"
   - URL: https://manualdedonos.com.br

#### Teste 2: Email inativo
1. Adicione email na whitelist com status='inactive'
2. Tente signup
3. Esperado: ❌ "Sua conta está inativa."
   - Link "Entre em contato com o suporte"
   - URL: https://manualdedonos.com.br/suporte

#### Teste 3: Email ativo
1. Adicione email na whitelist com status='active'
2. Signup com senha válida
3. Esperado: ✅ Conta criada, login automático

#### Teste 4: Login com conta inativa
1. Crie usuário com email ativo (signup)
2. Mude status para 'inactive' no BD
3. Tente login
4. Esperado: ❌ Bloqueado mesmo com senha correta

---

## 📋 URLs Customizáveis

Se o Manual de Donos tiver URLs diferentes:

**Arquivo**: `app/api/auth/signup/route.ts`
**Linha 95**: `helpUrl: 'https://manualdedonos.com.br'`

**Arquivo**: `app/api/auth/login/route.ts` (se precisar)
**Linha 26**: `helpUrl: 'https://manualdedonos.com.br/suporte'`

Atualize conforme necessário.

---

## 🔍 Logging & Monitoring

O sistema registra tudo em logs:

```
✅ [WHITELIST] Authorization granted: user@example.com
❌ [WHITELIST] Email not authorized: unknown@example.com
⚠️ [WHITELIST] Account inactive: inactive@example.com
```

Visualize nos logs da Vercel ou servidor.

---

## 📊 Status do Whitelist

### Fluxo de Signup
```
User Email Input
    ↓
Validação de Formato
    ↓
WHITELIST CHECK ← Novo!
    ├─ Não encontrado → ❌ 403 + link
    ├─ Inativo → ❌ 403 + suporte
    └─ Ativo → ✅ Continua
    ↓
Password Validation
    ↓
Create Account
```

### Fluxo de Login
```
User Credentials
    ↓
WHITELIST CHECK ← Novo!
    ├─ Inativo → ❌ 403 (mesmo com senha correta)
    └─ Ativo/Não existe → ✅ Continua
    ↓
Auth Validation
    ↓
Login Success
```

---

## ✨ O Que Vem Depois

1. **Web Search** (1-2h)
   - Serper integration
   - Chat toggle
   - Results injection

2. **Code Cleanup** (15 min)
   - Remove temp files
   - Update .gitignore

3. **Code Review** (30 min)
   - Security check
   - Performance check

4. **Vercel Deploy** (20 min)
   - GitHub integration
   - Environment setup
   - Deploy

**Total V1: ~3-4h até produção**

---

## ⚠️ Cuidados

- **Não expose** a tabela `authorized_users` para usuários normais
- **RLS Policy** permite ler (para validar signup) mas não modificar
- **Admin** precisa gerenciar via Supabase ou API custom (v1.1)

---

## ✅ Checklist Whitelist

- [ ] SQL migration executada no Supabase
- [ ] Tabela `authorized_users` criada
- [ ] Índices criados (email, status)
- [ ] RLS policy active
- [ ] Dados importados (CSV ou manual)
- [ ] Teste: Email não autorizado
- [ ] Teste: Email inativo
- [ ] Teste: Email ativo (signup)
- [ ] Teste: Email ativo (login)
- [ ] Teste: Conta inativa (block login)
- [ ] URLs customizadas (se necessário)
- [ ] Ready para Web Search

---

**Status**: 🟢 **WHITELIST PRONTO**

Próximo passo: Executar SQL migration no Supabase

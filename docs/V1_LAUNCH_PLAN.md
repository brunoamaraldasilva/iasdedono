# V1 Launch Plan - Reta Final

**Data**: 4 de Abril de 2026
**Objetivo**: Deploy em Vercel com qualidade production-ready

---

## 🧹 FASE 1: LIMPEZA (15 minutos)

### Arquivos a Remover

#### Documentação Obsoleta (safe to delete)
```
docs/PHASE2_SQL_DOCUMENTS.sql              ❌ Schema antigo
docs/PHASE2_RLS_FIX.sql                    ❌ Fix aplicado
docs/PHASE2_ADD_MESSAGE_DOCUMENTS.sql      ❌ Migration executada
docs/PHASE2_MIGRATE_CONVERSATION_DOCUMENTS.sql ❌ Antigo
docs/PHASE2_ADD_FILE_TYPES.sql             ❌ Constraint aplicada
docs/FIX_FILE_TYPE_CONSTRAINT.sql          ❌ Já executado
docs/ACTION_CHECKLIST.md                   ❌ Testing memo antigo
docs/NEXT_STEPS.md                         ❌ Instruções antigas
docs/TEST_PLAN.md                          ❌ Plan descartável
docs/IMPLEMENTATION_STATUS.md              ❌ Status obsoleto
docs/FINAL_CONTEXT_SCHEMA.sql              ❌ Schema antigo
docs/FINAL_CONTEXT_SCHEMA_FIXED.sql        ❌ Versão anterior
docs/NUKE_AND_REBUILD.sql                  ❌ Experimental
SESSION_3_SUMMARY.md                       ❌ Log antigo
```

#### Arquivos Inúteis (safe to delete)
```
.env.local.example         ❌ Sem valores úteis (criar novo)
next.config.ts            ❌ Config padrão (não necessário)
```

#### Manter (IMPORTANTE!)
```
docs/PROJECT_STATUS_V1.md                  ✅ Novo status completo
docs/V1_LAUNCH_PLAN.md                     ✅ Este arquivo
lib/documentProcessing.ts                  ✅ Lógica de upload
app/api/documents/upload/route.ts          ✅ Upload endpoint
hooks/useAuth.ts                           ✅ Auth com timeout fix
hooks/useChat.ts                           ✅ Chat otimizado
app/dashboard/layout.tsx                   ✅ Sidebar otimizado
.gitignore                                 ✅ Manter e revisar
package.json                               ✅ Dependencies
tsconfig.json                              ✅ Config TypeScript
tailwind.config.ts                         ✅ Tailwind setup
```

---

## 🔍 FASE 2: CODE REVIEW (30 minutos)

### Review Checklist
- [ ] Security: Nenhuma API key exposta
- [ ] Performance: N+1 queries fixadas
- [ ] Types: Nenhum `any` perigoso
- [ ] Error handling: Todos endpoints tratam erro
- [ ] Auth: Timeouts e race conditions fixadas
- [ ] Environment: Todas vars em .env

### Arquivos Críticos para Review
1. `hooks/useAuth.ts` - Auth logic
2. `hooks/useChat.ts` - Chat streaming
3. `app/api/chat/route.ts` - Prompt injection
4. `app/api/documents/upload/route.ts` - File handling
5. `app/dashboard/layout.tsx` - Performance
6. `middleware.ts` - Route protection

---

## 📦 FASE 3: SETUP VERCEL (20 minutos)

### Novo `.env.example`
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (SECRET in Vercel)

# OpenAI
OPENAI_API_KEY=sk-... (SECRET in Vercel)

# App
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

### Configuração Vercel
```
Project: c-lvls
Framework: Next.js
Build Command: npm run build
Start Command: npm start
Node Version: 20.x (LTS)

Environment Variables:
  - NEXT_PUBLIC_SUPABASE_URL ✅ Public
  - NEXT_PUBLIC_SUPABASE_ANON_KEY ✅ Public
  - NEXT_PUBLIC_APP_URL ✅ Public
  - SUPABASE_SERVICE_ROLE_KEY 🔒 Secret
  - OPENAI_API_KEY 🔒 Secret

Auto Deploy: ON (main branch)
Preview Deployments: ON
```

---

## ✅ PRÉ-DEPLOY CHECKLIST

### Code Quality
- [ ] Nenhum `console.log` de debug
- [ ] Nenhum `// TODO` não documentado
- [ ] TypeScript sem erros
- [ ] Build local funciona: `npm run build && npm start`

### Segurança
- [ ] Nenhuma API key no código
- [ ] `.env.local` NÃO está no git
- [ ] `.env.example` tem placeholders
- [ ] Rate limiting ativado (em comentário, pode ativar)
- [ ] RLS policies no Supabase OK

### Performance
- [ ] Build size aceitável
- [ ] Nenhuma import desnecessária
- [ ] Images otimizadas
- [ ] CSS/JS minificado

### Testes Manuais
- [ ] Login funciona ✅
- [ ] Chat com novo usuário ✅
- [ ] Upload de documento ✅
- [ ] Context save ✅
- [ ] Logout seguro ✅
- [ ] Hard refresh (Cmd+Shift+R) não trava ✅

---

## 🚀 DEPLOY SEQUENCE

### 1. Local Final Check (5 min)
```bash
npm run build  # Deve completar sem erros
npm start      # Deve iniciar em localhost:3000
```

### 2. Push para GitHub (1 min)
```bash
git add .
git commit -m "V1: Production ready - cleanup and optimizations"
git push origin main
```

### 3. Vercel Deployment (2 min)
- Conectar GitHub se não estiver
- Autorizar novo build
- Esperar ~2 minutos
- Teste o URL de preview

### 4. Testes em Produção (10 min)
- [ ] Abrir em navegador
- [ ] Signup novo usuário
- [ ] Login com credenciais
- [ ] Chat funciona
- [ ] Upload de documento
- [ ] Context save
- [ ] Logout
- [ ] Mobile (iPhone/Android)

### 5. Communicação Stakeholder (5 min)
- Enviar URL de produção
- Enviar credenciais de teste
- Instruções de acesso
- Feedback loop

---

## 🎯 DECISÕES IMPORTANTES

### Q: E o Admin Interface?
**A**: Não está em V1 Beta. Apenas 3 personas base.
- Será adicionado em V1.1
- Não afeta funcionalidade principal

### Q: E Web Search?
**A**: Não está em V1 Beta.
- Feature nice-to-have
- Será V1.2

### Q: E Compartilhamento?
**A**: Não está em V1 Beta.
- Feature de social sharing
- Será V1.1

### Q: E Whitelist de Emails?
**A**: Depende do client.
- Se precisa: Pode ser adicionado rapidinho
- Se não precisa: Skip

---

## 📋 ORDEM DE EXECUÇÃO RECOMENDADA

**Agora** (você aqui):
1. Ler `PROJECT_STATUS_V1.md` ✅
2. Confirmar escopo com você

**Próximo**:
1. **Limpeza** de arquivos (15 min)
2. **Code Review** com superpowers (30 min)
3. **Vercel Setup** (20 min)
4. **Deploy** (10 min)
5. **Testing** em produção (10 min)

**Total: ~85 minutos para V1 em produção**

---

## ⚡ WHAT IF ISSUES

### If build fails
- Check `npm run build` local
- Verify Node version (20.x)
- Check environment variables

### If deploy slow
- Normal para primeira vez
- Vercel caches depois
- Preview ~1min, Production ~2min

### If login fails
- Verificar SUPABASE_URL e ANON_KEY
- Check Supabase project está ativa
- Auth policies OK

### If chat fails
- Verificar OPENAI_API_KEY está correto
- Check rate limits OpenAI
- Check Supabase connection

---

**Status Final**: 🟢 **PRONTO PARA LANÇAR**

Próximo passo: Você confirma o escopo acima?

# Mobile Responsiveness - Passo a Passo Específico

## 🎯 Objetivo

Fazer a app funcionar perfeitamente em iPhone 14 Pro Max (e outros mobiles).

---

## 1️⃣ FIX: Sidebar (Collapse no Mobile)

### Arquivo: `app/dashboard/layout.tsx`

**Mudanças necessárias:**

```typescript
'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[#161616]">
      {/* Sidebar */}
      <aside className={`
        fixed md:static
        left-0 top-0 h-full
        bg-[#222423] border-r border-[#333333]
        transition-all duration-300 z-50
        ${sidebarOpen ? 'w-[250px]' : 'w-0 md:w-[250px]'}
        overflow-hidden
      `}>
        <Sidebar />
      </aside>

      {/* Mobile overlay (quando sidebar aberto) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header com toggle no mobile */}
        <header className="md:hidden bg-[#222423] border-b border-[#333333] p-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-[#e0521d] text-2xl"
          >
            ☰
          </button>
          <h1 className="text-[#ffffff] font-bold">IAs de Dono</h1>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
```

**O que muda:**
- ✅ Mobile: Sidebar hidden, aparece com toggle
- ✅ Desktop (md:): Sidebar sempre visível
- ✅ Overlay escuro quando sidebar aberto

---

## 2️⃣ FIX: PersonaSelector (Carousel no Mobile)

### Arquivo: `components/PersonaSelector.tsx`

**Mudanças necessárias:**

```typescript
'use client'

export default function PersonaSelector() {
  return (
    <div className="w-full">
      <h3 className="text-sm md:text-base text-[#999999] font-semibold mb-3 md:mb-4">
        IAS DISPONÍVEIS
      </h3>

      {/* Mobile: Carousel horizontal / Desktop: Grid */}
      <div className={`
        grid gap-3 md:gap-4
        grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3
        auto-rows-max
      `}>
        {personas.map((persona) => (
          <button
            key={persona.id}
            onClick={() => onSelect(persona.id)}
            className={`
              p-3 md:p-4 rounded-lg transition-all
              text-center
              text-xs md:text-sm
              ${selected === persona.id
                ? 'bg-[#e0521d] text-white'
                : 'bg-[#222423] text-[#cccccc] hover:border-[#e0521d]'
              }
              border border-[#333333]
              active:scale-95 md:hover:scale-105
            `}
          >
            <div className="text-xl md:text-2xl mb-1 md:mb-2">{persona.icon}</div>
            <div className="font-semibold line-clamp-2">{persona.name}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

**O que muda:**
- ✅ Mobile: 2 colunas (cabe na tela)
- ✅ Tablet: 3 colunas
- ✅ Desktop: 4 colunas
- ✅ Text menor no mobile
- ✅ Padding adaptado

---

## 3️⃣ FIX: ChatWindow (Responsivo)

### Arquivo: `components/ChatWindow.tsx`

**Mudanças principais:**

```typescript
// Dentro do component
return (
  <div className="flex flex-col h-full bg-[#161616]">
    {/* Messages Container */}
    <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-6 space-y-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`
              max-w-[85%] md:max-w-[70%] lg:max-w-[60%]
              p-3 md:p-4 rounded-lg
              text-sm md:text-base
              ${msg.role === 'user'
                ? 'bg-[#e0521d] text-white'
                : 'bg-[#222423] text-[#cccccc]'
              }
              break-words
            `}
          >
            {msg.content}
          </div>
        </div>
      ))}
    </div>

    {/* Input Area */}
    <div className="border-t border-[#333333] p-3 md:p-4 bg-[#222423]">
      <MessageInput />
    </div>
  </div>
)
```

**O que muda:**
- ✅ Padding menor no mobile
- ✅ Font menor mas legível
- ✅ Max-width das mensagens adaptado
- ✅ Break words para não overflow

---

## 4️⃣ FIX: MessageInput (Touch-Friendly)

### Arquivo: `components/MessageInput.tsx`

**Mudanças necessárias:**

```typescript
'use client'

export default function MessageInput() {
  return (
    <form onSubmit={handleSubmit} className="flex gap-2 md:gap-3">
      {/* Input */}
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Mensagem..."
        className={`
          flex-1
          px-3 md:px-4 py-2 md:py-3
          text-sm md:text-base
          rounded-lg
          bg-[#222423] text-white
          border border-[#333333]
          focus:border-[#e0521d]
          outline-none
        `}
      />

      {/* Botão Anexo - Maior no mobile */}
      <button
        type="button"
        onClick={handleAttach}
        className={`
          px-3 md:px-4 py-2 md:py-3
          text-lg md:text-xl
          rounded-lg
          bg-[#222423] text-[#e0521d]
          border border-[#333333]
          active:bg-[#e0521d] active:text-[#222423]
          transition-colors
        `}
      >
        📎
      </button>

      {/* Botão Enviar - Maior no mobile */}
      <button
        type="submit"
        className={`
          px-4 md:px-6 py-2 md:py-3
          text-sm md:text-base font-semibold
          rounded-lg
          bg-[#e0521d] text-white
          active:bg-[#ff6b35]
          transition-colors
          whitespace-nowrap
        `}
      >
        Enviar
      </button>
    </form>
  )
}
```

**O que muda:**
- ✅ Botões maiores (touch-friendly)
- ✅ Padding adaptado
- ✅ Sem overflow
- ✅ Active state em vez de hover (mobile)

---

## 5️⃣ FIX: Conversas List (Full-Width no Mobile)

### Arquivo: `components/Sidebar.tsx` (parte conversations)

**Mudanças necessárias:**

```typescript
// Dentro da seção CONVERSAS RECENTES
<div className="flex-1 overflow-y-auto px-2 md:px-4 space-y-2">
  {conversations.map((conv) => (
    <button
      key={conv.id}
      onClick={() => router.push(`/dashboard/chat/${conv.id}`)}
      className={`
        w-full text-left
        p-2 md:p-3
        rounded-lg
        text-xs md:text-sm
        transition-colors
        ${selectedId === conv.id
          ? 'bg-[#e0521d] text-white'
          : 'bg-transparent text-[#999999] hover:bg-[#222423]'
        }
        truncate
      `}
    >
      {conv.title}
    </button>
  ))}
</div>
```

**O que muda:**
- ✅ Full width (100%)
- ✅ Text pequeno mas legível
- ✅ Padding adaptado
- ✅ Hover states mobile-friendly

---

## 6️⃣ FIX: Context Page (Simples e Limpo)

### Arquivo: `app/dashboard/context/page.tsx`

**Mudanças principais:**

```typescript
export default function ContextPage() {
  return (
    <div className="flex flex-col h-full bg-[#161616]">
      {/* Header */}
      <div className="border-b border-[#333333] p-4 md:p-6 bg-[#222423]">
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-white">
          Contexto do Negócio
        </h1>
        <p className="text-xs md:text-sm text-[#999999] mt-1">
          Preencha para melhores resultados
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl">
          {/* Progress */}
          <div className="mb-6">
            <div className="text-sm md:text-base text-[#cccccc] mb-2">
              Preenchimento {completion}%
            </div>
            <div className="w-full bg-[#222423] rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#10b981] h-full transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4 md:space-y-6">
            {/* Nome da Empresa */}
            <div>
              <label className="block text-sm md:text-base text-white font-semibold mb-2">
                Nome da Empresa *
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="ex: Pipocas Pipooca"
                className={`
                  w-full
                  px-3 md:px-4 py-2 md:py-3
                  text-sm md:text-base
                  rounded-lg
                  bg-[#222423] text-white
                  border border-[#333333]
                  focus:border-[#e0521d]
                  outline-none
                `}
              />
            </div>

            {/* Tipo de Negócio */}
            <div>
              <label className="block text-sm md:text-base text-white font-semibold mb-2">
                Tipo de Negócio *
              </label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className={`
                  w-full
                  px-3 md:px-4 py-2 md:py-3
                  text-sm md:text-base
                  rounded-lg
                  bg-[#222423] text-white
                  border border-[#333333]
                  focus:border-[#e0521d]
                  outline-none
                `}
              >
                <option value="">Selecione...</option>
                <option value="retail">Varejo</option>
                <option value="services">Serviços</option>
                <option value="tech">Tecnologia</option>
              </select>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm md:text-base text-white font-semibold mb-2">
                Descrição do Negócio
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Conte mais sobre seu negócio..."
                rows={4}
                className={`
                  w-full
                  px-3 md:px-4 py-2 md:py-3
                  text-sm md:text-base
                  rounded-lg
                  bg-[#222423] text-white
                  border border-[#333333]
                  focus:border-[#e0521d]
                  outline-none
                  resize-vertical
                `}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**O que muda:**
- ✅ Layout vertical (mobile-first)
- ✅ Inputs full-width
- ✅ Padding adaptado
- ✅ Header colado no topo

---

## 📊 Breakpoints Tailwind (Já Configurados)

```
sm  640px
md  768px
lg  1024px
xl  1280px
2xl 1536px
```

Use assim:
- `text-xs md:text-base` = pequeno mobile, normal desktop
- `px-3 md:px-6` = padding pequeno mobile, grande desktop
- `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` = 1 coluna mobile, 2 tablet, 3 desktop

---

## ✅ Checklist Mobile Responsiveness

- [ ] Sidebar collapsa no mobile
- [ ] Conversas full-width
- [ ] Personas em grid 2x2
- [ ] Chat responsive (padding, font)
- [ ] MessageInput touch-friendly (botões maiores)
- [ ] Context page otimizada
- [ ] Testar em iPhone 14 Pro Max
- [ ] Testar em outros tamanhos (SM, MD, LG)

---

## 🚀 Próximas Fases

Depois de MOBILE estar 100%:

1. **Admin Interface** (Agent CRUD)
2. **Agent Materials** (Upload + Management)
3. **Integração no Chat** (Use agent materials dynamically)


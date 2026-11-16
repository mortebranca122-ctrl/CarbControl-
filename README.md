<div align="center">

# 🍎 CarbControl — Sukuna Edition

### *"Conheça seus alimentos. Registre seus carboidratos."*

*Controle hoje, mais liberdade amanhã.* ✨

![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)
![Offline](https://img.shields.io/badge/Offline--First-100%25%20Local-2EA043?style=for-the-badge)

![IndexedDB](https://img.shields.io/badge/IndexedDB-Dexie.js-F80?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

![Vitest](https://img.shields.io/badge/Testes-Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Base Nutricional](https://img.shields.io/badge/Base--Nutricional-TBCA%20%7C%20TACO-BC4C00?style=for-the-badge)

</div>

Aplicativo **Progressive Web App (PWA)** completo, **offline** e **100% local** para contagem de carboidratos, diário alimentar, banco nutricional brasileiro (**TBCA/USP**, **TACO/UNICAMP** e rótulos), receitas, leitor de código de barras, histórico clínico (glicemia e insulina) e exportação de relatórios em **PDF**.

---

## 📑 Índice

| Nº | Seção |
|:--:|-------|
| 01 | [⚠️ Aviso importante](#aviso-importante) |
| 02 | [✨ Principais funcionalidades](#funcionalidades) |
| 03 | [📲 Instalação](#instalacao) — [🖥️ Windows 10 e 11](#windows) · [📱 Android](#android) |
| 04 | [🚀 Como abrir](#como-abrir) |
| 05 | [🛠️ Comandos de desenvolvimento e testes](#comandos) |
| 06 | [🧱 Stack tecnológica](#stack) |

---

<a id="aviso-importante"></a>

## ⚠️ Aviso importante

> [!IMPORTANT]
> O **CarbControl** é uma ferramenta de **organização e contagem de carboidratos** baseada em referências nutricionais documentadas.
>
> Ele **não** calcula, sugere ou ajusta **doses de insulina**, nem substitui acompanhamento **médico** ou **nutricional**.

---

<a id="funcionalidades"></a>

## ✨ Principais funcionalidades

| | Funcionalidade | O que entrega |
|:-:|---|---|
| 📊 | **Dashboard em tempo real** | Resumo diário com refeições registradas, carboidratos totais, última glicemia e gráfico de progresso — construído **exclusivamente** com registros reais armazenados no dispositivo. |
| 🧮 | **Contador de carboidratos** | Pesquisa rápida com separação estrita de alimentos **crus vs. cozidos**, conversão por medidas caseiras documentadas, montagem multi-itens e registro direto no diário. |
| 📔 | **Diário alimentar — 6 refeições** | Café da manhã, lanche da manhã, almoço, lanche da tarde, jantar e ceia, com edição/exclusão, observações, registro de **glicemia** (antes e 2h após) e **insulina** aplicada. |
| 🍽️ | **Banco de alimentos + código de barras** | Base inicial **TBCA/USP** e **TACO/UNICAMP**, cadastro manual por rótulo e leitor por câmera (ou código **EAN** manual). |
| 👩‍🍳 | **Receitas e favoritos** | Ingredientes rastreáveis, cálculo automático por porção e reutilização direta no diário. |
| 📈 | **Histórico, gráficos e PDF** | Filtros **diário, semanal, mensal** e período personalizado, com geração **local** de PDF pronto para download, impressão e compartilhamento. |
| 🔐 | **Privacidade, segurança & backup** | **IndexedDB** local (Dexie.js), bloqueio opcional por **PIN** (PBKDF2-SHA256) e exportação/restauração de backup criptografado (**AES-256-GCM**). |

> 🧮 **Fórmula de conversão usada no contador**
>
> ```text
> carboidratos = (peso em gramas × carboidratos por 100 g) / 100
> ```
>
> A conversão utiliza **medidas caseiras documentadas** e mantém a separação estrita entre alimentos **crus** e **cozidos**.

---

<a id="instalacao"></a>

## 📲 Instalação

<a id="windows"></a>

### 🖥️ Windows 10 e 11 — Google Chrome ou Microsoft Edge

1. Acesse o aplicativo no navegador.
2. Clique no botão **Instalar PWA** no menu lateral (ou no ícone de instalação na barra de endereços do navegador).
3. Confirme a instalação — o aplicativo abrirá em **janela independente**, aparecerá no **Menu Iniciar** e funcionará **offline**.

<a id="android"></a>

### 📱 Android — Google Chrome ou Edge

1. Abra o aplicativo no navegador do celular.
2. Toque no menu **⋮** (canto superior direito) ou no botão **Instalar no Android ou Windows** em *Configurações*.
3. Selecione **Instalar aplicativo** / **Adicionar à tela inicial**.

---

<a id="como-abrir"></a>

## 🚀 Como abrir

### 💾 Direto no navegador (duplo clique)

Basta abrir o **`dist/index.html`** (ou até o **`index.html`** da raiz, que redireciona automaticamente) — tudo abre e funciona direto, com banco local persistido no navegador.

### ☁️ Publicar online

Envie o conteúdo da pasta **`dist/`** para **Vercel**, **Netlify**, **Cloudflare Pages**, **GitHub Pages** ou qualquer servidor web — inclusive em **subpastas**.

### 🧰 Servidor estático opcional

```bash
npx serve dist
# ou
python -m http.server 8080 -d dist
```

---

<a id="comandos"></a>

## 🛠️ Comandos de desenvolvimento e testes

| Comando | O que faz |
|---|---|
| `npm install` | Instala as dependências do projeto |
| `npm run dev` | Inicia o **servidor de desenvolvimento** na porta `3000` |
| `npm run lint` | Executa a verificação de tipos do **TypeScript** |
| `npm test` | Roda a suíte de testes **Vitest** |
| `npm run build` | Gera o **build de produção** + **Service Worker** da PWA |

```bash
npm install
npm run dev       # Servidor de desenvolvimento na porta 3000
npm run lint      # Verificação TypeScript
npm test          # Executa a suíte Vitest
npm run build     # Build de produção + Service Worker PWA
```

---

<a id="stack"></a>

## 🧱 Stack tecnológica

| Camada | Tecnologia |
|---|---|
| 💻 Linguagem | **TypeScript** |
| 🌐 Formato do app | **PWA** — Service Worker gerado no build de produção |
| 🗄️ Armazenamento | **IndexedDB** local via **Dexie.js** |
| 🔒 Segurança | PIN opcional com **PBKDF2-SHA256** · backup com **AES-256-GCM** |
| 🧪 Testes | **Vitest** |
| 🥦 Base nutricional | **TBCA/USP** · **TACO/UNICAMP** |

---

<div align="center">

**🍎 CarbControl — Sukuna Edition**

*"Controle hoje, mais liberdade amanhã."*

</div>

<div align="center">

# 💠 Fluxo — Controle Financeiro Pessoal

**Um painel de finanças pessoais com visual de automação, login com Google e sincronização em nuvem.**

[![Live Demo](https://img.shields.io/badge/demo-online-00e5a0?style=for-the-badge)](https://controle-financeiro-seven-ivory.vercel.app)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

</div>

---

## 📌 Sobre o projeto

O **Fluxo** nasceu de um problema real: acompanhar despesas, contas a pagar e faturas de
cartão de crédito espalhadas em vários lugares diferentes. Em vez de usar uma planilha, decidi
construir meu próprio painel — com **autenticação real via Google**, **dados sincronizados na
nuvem** e um visual inspirado em ferramentas de automação (n8n, Zapier, Make), onde cada seção
do app funciona como um "nó" dentro de um pipeline.

O projeto foi pensado para uso pessoal, mas construído com as mesmas práticas que eu usaria em
um projeto profissional: **sem credenciais hardcoded no código**, **variáveis de ambiente**,
**regras de segurança no banco de dados** e **deploy automatizado**.

🔗 **[Acessar o site em produção](https://controle-financeiro-seven-ivory.vercel.app)**

---

## ✨ Funcionalidades

| Área | O que faz |
|---|---|
| 🔐 **Autenticação** | Login com conta Google (Firebase Auth) ou modo local protegido por senha |
| ☁️ **Sincronização** | Dados salvos no Firestore, disponíveis em qualquer aparelho com a mesma conta |
| 📊 **Dashboard** | Renda, despesas, saldo e contas pendentes do mês, com gráficos por categoria |
| 🧾 **Despesas** | Lançamento de gastos com descrição, categoria (personalizável) e data |
| 💰 **Renda** | Lançamento opcional de receitas do mês |
| 📅 **Contas a pagar** | Tipo de conta, fornecedor, vencimento, taxa, valor, situação e observações |
| 💳 **Análise de crédito** | Ranking de fornecedores de cartão — quantos são e para quem devo mais |
| 📈 **Histórico** | Fechamento de mês com arquivamento automático e comparativo do melhor/pior mês do ano |
| 🖨️ **Exportação** | Pré-visualização em folha A4 e impressão/exportação em PDF |
| 📱 **Responsivo** | Layout adaptado para celular e desktop |

---

## 🖼️ Capturas de tela

<!--
  Adicione aqui prints do projeto (dashboard, contas a pagar, análise de crédito etc).
  Salve as imagens em docs/screenshots/ e referencie assim:
  ![Dashboard](docs/screenshots/dashboard.png)
-->
> _Screenshots em breve — veja a [demo ao vivo](https://controle-financeiro-seven-ivory.vercel.app) enquanto isso._

---

## 🛠️ Stack

- **Frontend:** HTML5, CSS3 (design system próprio, sem framework) e JavaScript puro (Vanilla JS)
- **Gráficos:** [Chart.js](https://www.chartjs.org/)
- **Autenticação e banco de dados:** [Firebase](https://firebase.google.com/) (Authentication + Firestore)
- **Deploy:** [Vercel](https://vercel.com/), com build próprio para injetar variáveis de ambiente
- **Sem frameworks front-end** — decisão consciente para manter o projeto leve e sem etapa de build complexa

---

## 🏗️ Arquitetura

```
fluxo/
├── index.html                        → Home → Login → App (single page)
├── scripts/generate-firebase-config.js  → gera a config do Firebase a partir de env vars no build
├── src/
│   ├── css/styles.css                → design system (tema "automação")
│   ├── js/app.js                     → toda a lógica (auth, dados, telas)
│   └── config/firebase-config.js     → gerado automaticamente, nunca commitado
└── vercel.json                       → build automático a cada deploy
```

Um ponto que fiz questão de resolver corretamente: as credenciais do Firebase **não ficam
hardcoded no repositório**. Elas são injetadas como variáveis de ambiente durante o build na
Vercel, e a segurança real dos dados é garantida por regras do Firestore que restringem cada
usuário a ler/escrever apenas os próprios dados.

---

## 🚀 Como rodar / publicar

<details>
<summary><strong>Ver guia técnico completo (Firebase, variáveis de ambiente e deploy na Vercel)</strong></summary>

### Rodando localmente
```bash
git clone https://github.com/Moises-Assuncao/controle-financeiro.git
cd controle-financeiro
cp .env.example .env      # preencha com as chaves do seu próprio projeto Firebase
npm run build              # gera src/config/firebase-config.js
```
Depois abra o `index.html` com um servidor local (ex: extensão "Live Server" do VS Code).

> **Sobre a chave do Firebase:** ela identifica o projeto, não é uma senha — o Google documenta
> isso oficialmente. Quem protege seus dados de verdade são as **regras do Firestore** (passo 2
> abaixo) e os **domínios autorizados** do login (passo 5). Mesmo assim, aqui ela nunca fica
> hardcoded nem versionada: é injetada por variável de ambiente no build.

### Passo 1 — Criar o projeto Firebase (gratuito)
1. Acesse **console.firebase.google.com** → "Adicionar projeto".
2. **Build → Authentication → Sign-in method** → ative o provedor **Google**.
3. **Build → Firestore Database → Criar banco de dados** (modo produção).

### Passo 2 — Regras do Firestore (isso sim protege seus dados)
Em **Firestore → Regras**, cole e publique:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /fluxo_users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
Isso garante que cada pessoa só lê/escreve os próprios dados, mesmo que alguém veja a
config do Firebase no código-fonte do navegador (o que é normal e esperado).

### Passo 3 — Pegar as chaves do projeto
Em **Configurações do projeto** (engrenagem) → **Geral** → "Seus apps" → ícone `</>` para
registrar um app Web → copie os valores de `firebaseConfig`.

### Passo 4 — Configurar as variáveis de ambiente
Na Vercel: **Project Settings → Environment Variables** e cadastre uma por uma:
```
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
```
A Vercel roda `npm run build` automaticamente a cada deploy (já configurado no
`vercel.json`) e gera a config sem nunca expor nada no repositório.

### Passo 5 — Autorizar o domínio do Vercel
Depois do primeiro deploy você recebe uma URL tipo `seu-projeto.vercel.app`. Volte em
**Authentication → Settings → Authorized domains** no Firebase e adicione esse domínio.
Sem isso, o login com Google é bloqueado em produção.

### Passo 6 — Publicar
```bash
git init
git add .
git commit -m "fluxo"
git remote add origin <url-do-seu-repo>
git push -u origin main
```
Depois importe o repositório em **vercel.com → Add New Project** (cadastre as variáveis
de ambiente antes do primeiro deploy), ou publique pela CLI:
```bash
npm i -g vercel
vercel
```

### Modo local (sem Google)
Na tela de login, "Continuar sem conta Google" cria uma senha local — os dados ficam só
naquele navegador (localStorage), sem depender do Firebase.

</details>

---

## 🗺️ Próximos passos

- [ ] Exportação dos relatórios também em planilha (.xlsx)
- [ ] Metas de gastos por categoria
- [ ] Notificações de vencimento de conta
- [ ] Modo claro

---

## 👤 Autor

**Moisés Assunção**
Estudante de Análise e Desenvolvimento de Sistemas (ESBAM)
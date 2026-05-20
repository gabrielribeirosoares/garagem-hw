
# 🏎️ Garagem HW - Gerenciador de Coleção Hot Wheels

Uma aplicação web (Single Page Application - SPA) desenvolvida para colecionadores de Hot Wheels gerenciarem, visualizarem e organizarem os seus acervos de forma rápida, intuitiva e totalmente sincronizada na nuvem.

🔗 **Acesse o projeto online:** [https://garagemhw.web.app](https://garagemhw.web.app)

---

## ✨ Funcionalidades

* **Autenticação Segura:** Login utilizando E-mail/Senha ou Conta Google (Firebase Auth).
* **Arquitetura SPA:** Navegação fluida entre "Todas as Coleções", "Super Treasure Hunts ($TH)" e "Minha Coleção" sem recarregamento da página.
* **Gerenciamento de Acervo:** Marque os carrinhos que já possui e acompanhe a quantidade de itens repetidos.
* **Filtros Dinâmicos:** Encontre carrinhos específicos filtrando por Nome, Ano, Era Clássica/Moderna ou Coleção/Série.
* **Dashboard Estatístico:** Acompanhe no cabeçalho o total de carros, quantos você já tem, quantos faltam e a sua quantidade de repetidos.
* **Galeria Interativa (Lightbox):** Clique na imagem do carrinho para expandi-la e ver os detalhes.
* **Banco de Dados Real-time:** Todas as alterações na sua coleção são salvas automaticamente na nuvem usando Firebase Firestore.

---

## 🛠️ Tecnologias Utilizadas

Este projeto foi construído utilizando tecnologias nativas do front-end integradas ao ecossistema Firebase (BaaS):

* **HTML5 & CSS3:** Estrutura semântica e estilização responsiva com suporte a dispositivos móveis.
* **JavaScript (Vanilla ES6+):** Lógica da aplicação, manipulação do DOM e sistema de roteamento SPA baseados em módulos (`type="module"`).
* **Firebase Authentication:** Gestão de usuários, senhas e provedor de login do Google.
* **Firebase Firestore:** Banco de dados NoSQL estruturado em documentos para salvar o perfil do usuário e seu progresso na coleção.
* **Firebase Hosting:** Implantação e hospedagem da aplicação.

---

## 📂 Estrutura do Projeto

```text
/
├── public/                 # Pasta servida pelo Firebase Hosting
│   ├── index.html          # Tela de login e boas-vindas
│   ├── app.html            # Aplicação principal (SPA)
│   ├── signup.html         # Tela de criação de conta
│   ├── perfil.html         # Tela de edição de perfil de usuário
│   ├── termos-de-uso.html
│   ├── politica-de-privacidade.html
│   └── assets/
│       ├── css/
│       │   ├── styles.css
│       │   ├── signup-style.css
│       │   └── legal.css
│       ├── img/            # Imagens do sistema (logo, animação do impala)
│       └── js/
│           ├── auth.js             # Lógica de login e provedores
│           ├── app.js              # Lógica principal, filtros, renderização e SPA
│           ├── signup.js           # Criação de contas e validações
│           ├── perfil.js           # Edição de dados do Firestore
│           ├── data.js             # Base de dados em JSON com a lista de carrinhos
│           └── firebase-config.js  # Inicialização do SDK do Firebase
├── firebase.json           # Configurações do Firebase Hosting
└── README.md               # Documentação do projeto

```

---

## 🚀 Como executar o projeto localmente

Caso queira clonar o repositório e rodar no seu próprio computador:

1. **Clone o repositório:**
```bash
git clone [https://github.com/seu-usuario/garagem-hw.git](https://github.com/seu-usuario/garagem-hw.git)

```


2. **Abra o projeto na sua IDE (ex: VS Code):**
```bash
cd garagem-hw
code .

```


3. **Inicie um servidor local:**
Como o projeto utiliza Módulos JavaScript (`import`/`export`), ele não pode ser aberto diretamente dando dois cliques no arquivo `.html` (devido à política de CORS dos navegadores).
* No VS Code, instale a extensão **Live Server**.
* Clique com o botão direito no arquivo `public/index.html` e selecione **"Open with Live Server"**.



---

## 🛡️ Notas de Segurança e Privacidade

A base de dados (Firestore) possui regras de segurança estruturadas para garantir que cada usuário tenha acesso **apenas** ao seu próprio documento de coleção e que informações pessoais sejam protegidas em conformidade com as diretrizes descritas na Política de Privacidade do app.

```

```

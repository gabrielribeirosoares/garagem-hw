# Hot Wheels Collection App

Estrutura inicial para transformar o site em produto com autenticação e coleção por usuário.

## Páginas
- `index.html`: login.
- `app.html`: coleção autenticada.

## Estrutura
- `assets/css/styles.css`: estilos compartilhados.
- `assets/js/auth.js`: fluxo de login/local session.
- `assets/js/app.js`: renderização da tabela e coleção por usuário.
- `assets/js/data.js`: base de carros.

## Próximo passo (Firebase)
1. Ativar Firebase Authentication (Email/Senha).
2. Trocar `localStorage` por Firebase Auth + Firestore/Realtime Database.
3. Publicar via Firebase Hosting.

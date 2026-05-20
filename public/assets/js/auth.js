import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
// ATENÇÃO: Adicionamos a importação do Firestore para ir buscar o nome
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const welcomeOverlay = document.getElementById('welcome-overlay');
const welcomeMessage = document.getElementById('welcome-message');

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Esconde o erro caso ele tenha errado a palavra-passe na tentativa anterior
    if (errorMessage) errorMessage.style.display = 'none';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Muda o estado do botão para dar feedback visual
    const btnSubmit = loginForm.querySelector('button[type="submit"]');
    const originalBtnText = btnSubmit.textContent;
    btnSubmit.textContent = "Acessando...";
    btnSubmit.disabled = true;

    try {
      // 1. Tenta fazer o login no Firebase
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      let firstName = "Colecionador"; // Nome por defeito caso falhe tudo

      // 2. Vai buscar o nome verdadeiro à base de dados (Firestore)
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().name) {
          // Se encontrou no banco de dados, pega o primeiro nome
          firstName = userDoc.data().name.split(" ")[0];
        } else if (user.displayName) {
          // Plano B: Tenta usar o da Autenticação
          firstName = user.displayName.split(" ")[0];
        }
      } catch (dbError) {
        console.error("Erro ao buscar nome na base de dados:", dbError);
        // Se a base de dados falhar, tenta o Plano B na mesma
        if (user.displayName) {
          firstName = user.displayName.split(" ")[0];
        }
      }

      // 3. Atualiza a mensagem e mostra a animação de boas-vindas
      if (welcomeOverlay && welcomeMessage) {
        welcomeMessage.textContent = `Olá ${firstName}, seja muito bem-vindo(a) à sua Garagem.`;
        welcomeOverlay.classList.add('active');

        // AGORA AGUARDA 4 SEGUNDOS PARA A CENA TODA ACONTECER
        setTimeout(() => {
          window.location.href = 'app.html';
        }, 5000);
      } else {
        // Se houver algum problema e a tela de animação não existir, vai direto
        window.location.href = 'app.html';
      }

    } catch (error) {
      console.error("Erro no login:", error);

      // Restaura o botão caso dê erro
      btnSubmit.textContent = originalBtnText;
      btnSubmit.disabled = false;

      // Mostra a caixa de erro vermelha
      if (errorMessage) {
        errorMessage.textContent = "Falha no login. Verifique o seu e-mail e palavra-passe.";
        errorMessage.style.display = 'block';
      }
    }
  });
}
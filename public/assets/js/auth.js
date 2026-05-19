// assets/js/auth.js
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
const errorMessage = document.getElementById('error-message');
// Verifica se o usuário já está logado para redirecionar direto
onAuthStateChanged(auth, (user) => {
  if (user) {
    location.href = 'app.html';
  }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMessage.style.display = 'none';
  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;

  if (!email || password.length < 8) return;

  try {
    // Tenta fazer o login com o Firebase
    await signInWithEmailAndPassword(auth, email, password);
    // Se der certo, o onAuthStateChanged acima redirecionará para app.html
  } catch (error) {
    console.error("Erro ao fazer login:", error.code, error.message);
    errorMessage.textContent = "Falha no login. Verifique seu e-mail e senha.";
    errorMessage.style.display = 'block';
  }
});
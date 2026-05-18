// assets/js/signup.js
import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (password !== confirmPassword) {
    alert("As senhas não coincidem!");
    return;
  }

  try {
    // Cria o utilizador no Firebase Auth
    await createUserWithEmailAndPassword(auth, email, password);
    alert("Conta criada com sucesso!");
    location.href = 'app.html'; // Redireciona para a aplicação
  } catch (error) {
    console.error("Erro ao cadastrar:", error.code, error.message);
    if (error.code === 'auth/email-already-in-use') {
      alert("Este e-mail já está em uso.");
    } else {
      alert("Erro ao criar conta. Tente novamente.");
    }
  }
});
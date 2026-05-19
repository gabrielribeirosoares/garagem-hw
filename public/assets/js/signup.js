// assets/js/signup.js
import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const terms = document.getElementById('accept-terms').checked;
  const privacy = document.getElementById('accept-privacy').checked;
  const marketing = document.getElementById('accept-marketing')?.checked || false;

  if (!name || !email || !password || !confirmPassword) {
    alert('Preencha todos os campos obrigatórios.');
    return;
  }

  if (password !== confirmPassword) {
    alert('As senhas não coincidem!');
    return;
  }

  if (!terms || !privacy) {
    alert('Você precisa aceitar os Termos de Uso e a Política de Privacidade.');
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(cred.user, { displayName: name });

    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      name,
      email,
      marketing,
      acceptedTerms: true,
      acceptedPrivacy: true,
      createdAt: serverTimestamp()
    }, { merge: true });

    alert('Conta criada com sucesso!');
    location.href = 'app.html';
  } catch (error) {
    console.error("Erro ao cadastrar:", error.code, error.message);

    if (error.code === 'auth/email-already-in-use') {
      alert('Este e-mail já está em uso.');
    } else if (error.code === 'auth/invalid-email') {
      alert('E-mail inválido.');
    } else if (error.code === 'auth/weak-password') {
      alert('A senha deve ter pelo menos 6 caracteres.');
    } else {
      alert('Erro ao criar conta. Tente novamente.');
    }
  }
});

// Seleciona o campo de telefone pelo ID
const phoneInput = document.getElementById('phone');

// Adiciona um ouvinte de evento que dispara toda vez que o usuário digita algo
if (phoneInput) {
  phoneInput.addEventListener('input', (e) => {
    e.target.value = maskPhone(e.target.value);
  });
}

// Função responsável por aplicar a máscara brasileira
const maskPhone = (value) => {
  if (!value) return "";

  // Remove tudo que não for número
  value = value.replace(/\D/g, '');

  // Limita a quantidade máxima a 11 números (celular com DDD)
  if (value.length > 11) {
    value = value.slice(0, 11);
  }

  // Coloca os parênteses em volta dos 2 primeiros dígitos (DDD)
  value = value.replace(/(\d{2})(\d)/, "($1) $2");

  // Coloca o hífen antes dos últimos 4 dígitos
  value = value.replace(/(\d)(\d{4})$/, "$1-$2");

  return value;
};
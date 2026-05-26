import { auth, db } from './firebase-config.js';

import { onAuthStateChanged, updatePassword } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const profileForm = document.getElementById('profile-form');
const nameInput = document.getElementById('name');
const birthdateInput = document.getElementById('birthdate');
const phoneInput = document.getElementById('phone');
const emailInput = document.getElementById('email');
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const messageBox = document.getElementById('messageBox');

let currentUser = null;


onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    emailInput.value = user.email;

    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        nameInput.value = data.name || '';
        birthdateInput.value = data.birthdate || '';
        phoneInput.value = data.phone || '';
      }
    } catch (error) {
      console.error("Erro ao buscar dados do perfil:", error);
      showMessage("Erro ao carregar dados do banco.", "red");
    }
  } else {
    window.location.href = "index.html";
  }
});


profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMessage("Salvando alterações...", "blue");

  if (!currentUser) return;

  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;


  if (newPassword || confirmPassword) {
    if (newPassword !== confirmPassword) {
      showMessage("As senhas não coincidem!", "red");
      return;
    }
    if (newPassword.length < 6) {
      showMessage("A senha deve ter pelo menos 6 caracteres.", "red");
      return;
    }
  }

  try {

    if (newPassword) {
      await updatePassword(currentUser, newPassword);
    }


    const docRef = doc(db, 'users', currentUser.uid);
    await setDoc(docRef, {
      name: nameInput.value.trim(),
      birthdate: birthdateInput.value,
      phone: phoneInput.value.trim()
    }, { merge: true });

    showMessage("Perfil atualizado com sucesso!", "green");


    newPasswordInput.value = '';
    confirmPasswordInput.value = '';

    setTimeout(() => {
      window.location.href = "app.html";
    }, 1500);

  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);


    if (error.code === 'auth/requires-recent-login') {
      showMessage("Por segurança, saia da conta e faça login novamente para alterar sua senha.", "red");
    } else {
      showMessage("Erro ao salvar. Tente novamente.", "red");
    }
  }
});





function showMessage(text, color) {
  messageBox.textContent = text;
  messageBox.style.color = color;
}


phoneInput.addEventListener('input', (e) => {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length > 11) value = value.slice(0, 11);
  value = value.replace(/(\d{2})(\d)/, "($1) $2");
  value = value.replace(/(\d)(\d{4})$/, "$1-$2");
  e.target.value = value;
});
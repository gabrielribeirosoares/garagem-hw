// assets/js/perfil.js
import { auth, db } from './firebase-config.js';
// ATENÇÃO: Adicionamos o updatePassword na importação abaixo
import { onAuthStateChanged, updatePassword } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const profileForm = document.getElementById('profile-form');
const nameInput = document.getElementById('name');
const birthdateInput = document.getElementById('birthdate');
const phoneInput = document.getElementById('phone');
const emailInput = document.getElementById('email');
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const messageBox = document.getElementById('messageBox');

let currentUser = null;

// 1. CARREGA OS DADOS INICIAIS
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

// 2. SALVA AS ALTERAÇÕES
profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMessage("Salvando alterações...", "blue");

  if (!currentUser) return;

  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Validação das senhas (caso o usuário tenha digitado algo)
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
    // A. Atualiza a senha no Firebase Auth (se o campo foi preenchido)
    if (newPassword) {
      await updatePassword(currentUser, newPassword);
    }

    // B. Atualiza os dados no Firestore
    const docRef = doc(db, 'users', currentUser.uid);
    await updateDoc(docRef, {
      name: nameInput.value.trim(),
      birthdate: birthdateInput.value,
      phone: phoneInput.value.trim()
    });

    showMessage("Perfil atualizado com sucesso!", "green");
    
    // Limpa os campos de senha após salvar
    newPasswordInput.value = '';
    confirmPasswordInput.value = '';

    setTimeout(() => {
      window.location.href = "app.html";
    }, 1500);

  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    
    // Regra de segurança do Firebase: se o login for muito antigo, ele impede de trocar a senha
    if (error.code === 'auth/requires-recent-login') {
      showMessage("Por segurança, saia da conta e faça login novamente para alterar sua senha.", "red");
    } else {
      showMessage("Erro ao salvar. Tente novamente.", "red");
    }
  }
});

// =========================================
// FUNÇÕES AUXILIARES
// =========================================

function showMessage(text, color) {
  messageBox.textContent = text;
  messageBox.style.color = color;
}

// Máscara de Telefone
phoneInput.addEventListener('input', (e) => {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length > 11) value = value.slice(0, 11);
  value = value.replace(/(\d{2})(\d)/, "($1) $2");
  value = value.replace(/(\d)(\d{4})$/, "$1-$2");
  e.target.value = value;
});
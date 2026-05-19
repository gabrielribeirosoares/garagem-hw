// assets/js/signup.js
import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
// ATENÇÃO: Adicionamos collection, query, where e getDocs para buscar no banco
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const birthdate = document.getElementById('birthdate').value; 
  const phone = document.getElementById('phone').value.trim(); 
  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const terms = document.getElementById('accept-terms').checked;
  const privacy = document.getElementById('accept-privacy').checked;
  const marketing = document.getElementById('accept-marketing')?.checked || false;

  if (!name || !email || !password || !confirmPassword || !birthdate || !phone) {
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
    // ==========================================
    // NOVA VERIFICAÇÃO: TELEFONE DUPLICADO
    // ==========================================
    const usersRef = collection(db, 'users');
    const qPhone = query(usersRef, where('phone', '==', phone));
    const phoneSnapshot = await getDocs(qPhone);

    if (!phoneSnapshot.empty) {
      // Se não estiver vazio, significa que achou alguém com esse telefone
      alert('Este número de telefone/WhatsApp já está cadastrado em outra conta.');
      return; // Interrompe o processo e não cria o cadastro
    }
    // O E-mail já tem proteção automática no passo abaixo!

    // 1. Cria o usuário na Autenticação do Firebase
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // 2. Atualiza o perfil com o nome
    await updateProfile(cred.user, { displayName: name });

    // 3. Salva os dados extras no Firestore
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      name,
      birthdate, 
      phone,     
      email,
      marketing,
      acceptedTerms: true,
      acceptedPrivacy: true,
      createdAt: serverTimestamp()
    }, { merge: true });

    alert('Conta criada com sucesso!');
    
    // 4. Redireciona para a tela de login (index.html)
    window.location.href = 'index.html';

  } catch (error) {
    console.error("Erro ao cadastrar:", error.code, error.message);

    if (error.code === 'auth/email-already-in-use') {
      alert('Este e-mail já está em uso por outra conta.');
    } else if (error.code === 'auth/invalid-email') {
      alert('E-mail inválido.');
    } else if (error.code === 'auth/weak-password') {
      alert('A senha deve ter pelo menos 6 caracteres.');
    } else {
      alert('Erro ao criar conta. Tente novamente.');
    }
  }
});

// =========================================
// MÁSCARA DO TELEFONE / WHATSAPP
// =========================================

const phoneInput = document.getElementById('phone');

if (phoneInput) {
  phoneInput.addEventListener('input', (e) => {
    e.target.value = maskPhone(e.target.value);
  });
}

const maskPhone = (value) => {
  if (!value) return "";
  value = value.replace(/\D/g, '');
  if (value.length > 11) value = value.slice(0, 11);
  value = value.replace(/(\d{2})(\d)/, "($1) $2");
  value = value.replace(/(\d)(\d{4})$/, "$1-$2");
  return value;
};
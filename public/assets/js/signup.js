import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const messageBox = document.getElementById('messageBox');
const btnSubmit = document.querySelector('#signup-form button[type="submit"]');

// Função para mostrar mensagens na tela em vez de usar alert()
function showMessage(text, type) {
  if (!messageBox) return;
  messageBox.textContent = text;
  messageBox.style.display = 'block';
  
  if (type === 'success') {
    messageBox.style.color = '#15803d'; // Verde escuro
    messageBox.style.backgroundColor = '#dcfce7'; // Fundo verde claro
    messageBox.style.border = '1px solid #bbf7d0';
  } else {
    messageBox.style.color = '#b91c1c'; // Vermelho escuro
    messageBox.style.backgroundColor = '#fee2e2'; // Fundo vermelho claro
    messageBox.style.border = '1px solid #fecaca';
  }
}

document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  // Oculta mensagens antigas a cada nova tentativa
  if (messageBox) messageBox.style.display = 'none';

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
    showMessage('Preencha todos os campos obrigatórios.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showMessage('As senhas não coincidem!', 'error');
    return;
  }

  if (!terms || !privacy) {
    showMessage('Você precisa aceitar os Termos de Uso e a Política de Privacidade.', 'error');
    return;
  }

  // Desativa o botão enquanto processa
  const originalBtnText = btnSubmit.textContent;
  btnSubmit.textContent = "Criando conta...";
  btnSubmit.disabled = true;

  try {
    // ==========================================
    // VERIFICAÇÃO DE LIMITE DE USUÁRIOS
    // ==========================================
    const configRef = doc(db, 'config', 'app');
    const configSnap = await getDoc(configRef);

    if (configSnap.exists()) {
      const configData = configSnap.data();
      const maxUsers = configData.maxUsuarios || 0;
      const currentUsers = configData.cadastrados || 0;

      if (currentUsers >= maxUsers) {
        showMessage('As vagas para se cadastrar na Garagem HW estão esgotadas no momento!', 'error');
        btnSubmit.textContent = originalBtnText;
        btnSubmit.disabled = false;
        return; 
      }
    }

    // ==========================================
    // VERIFICAÇÃO: TELEFONE DUPLICADO
    // ==========================================
    const usersRef = collection(db, 'users');
    const qPhone = query(usersRef, where('phone', '==', phone));
    const phoneSnapshot = await getDocs(qPhone);

    if (!phoneSnapshot.empty) {
      showMessage('Este número de telefone/WhatsApp já está cadastrado em outra conta.', 'error');
      btnSubmit.textContent = originalBtnText;
      btnSubmit.disabled = false;
      return; 
    }

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

    // 4. Soma +1 NO CONTADOR DE USUÁRIOS
    if (configSnap.exists()) {
      await updateDoc(configRef, {
        cadastrados: increment(1)
      });
    }

    // Sucesso! Mostra a mensagem e redireciona após 2 segundos
    showMessage('Conta criada com sucesso! Redirecionando...', 'success');
    
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2000);

  } catch (error) {
    console.error("Erro ao cadastrar:", error.code, error.message);
    
    btnSubmit.textContent = originalBtnText;
    btnSubmit.disabled = false;

    if (error.code === 'auth/email-already-in-use') {
      showMessage('Este e-mail já está em uso por outra conta.', 'error');
    } else if (error.code === 'auth/invalid-email') {
      showMessage('E-mail inválido.', 'error');
    } else if (error.code === 'auth/weak-password') {
      showMessage('A senha deve ter pelo menos 6 caracteres.', 'error');
    } else {
      showMessage('Erro ao criar conta. Tente novamente.', 'error');
    }
  }
});

// =========================================
// MÁSCARA DO TELEFONE / WHATSAPP
// =========================================
const phoneInput = document.getElementById('phone');

if (phoneInput) {
  phoneInput.addEventListener('input', (e) => {
    let value = e.target.value;
    if (!value) return;
    value = value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{2})(\d)/, "($1) $2");
    value = value.replace(/(\d)(\d{4})$/, "$1-$2");
    e.target.value = value;
  });
}
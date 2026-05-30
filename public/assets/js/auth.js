import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const provider = new GoogleAuthProvider();
const loginForm = document.getElementById('login-form');
const btnGoogle = document.getElementById('btn-google');
const errorMessage = document.getElementById('error-message');
const welcomeOverlay = document.getElementById('welcome-overlay');
const welcomeMessage = document.getElementById('welcome-message');

const isIOSStandalone = window.navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

function redirectParaGaragem(user) {
  // TRAVA DE SEGURANÇA: Se a URL já for a home ou o app, aborta para não dar loop.
  if (window.location.pathname.includes('home.html') || window.location.pathname.includes('app.html')) {
    return;
  }

  let firstName = user.displayName ? user.displayName.split(" ")[0] : "Colecionador";

  if (welcomeOverlay && welcomeMessage) {
    welcomeMessage.textContent = `Olá ${firstName}, seja muito bem-vindo(a)!`;
    welcomeOverlay.classList.add('active');
    // REDIRECIONA PARA A HOME.HTML AGORA
    setTimeout(() => { window.location.replace('home.html'); }, 1500);
  } else {
    window.location.replace('home.html');
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    if (loginForm) loginForm.style.display = 'none';
    redirectParaGaragem(user);
  }
});

// ==========================================
// LOGIN COM E-MAIL E SENHA
// ==========================================
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorMessage) errorMessage.style.display = 'none';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btnSubmit = loginForm.querySelector('button[type="submit"]');
    const originalBtnText = btnSubmit.textContent;

    btnSubmit.textContent = "Acessando...";
    btnSubmit.disabled = true;

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      redirectParaGaragem(cred.user);
    } catch (error) {
      console.error("Erro no login com senha:", error);
      btnSubmit.textContent = originalBtnText;
      btnSubmit.disabled = false;
      if (errorMessage) {
        errorMessage.textContent = `Erro no Login (${error.code}): ${error.message}`;
        errorMessage.style.display = 'block';
      }
    }
  });
}

// ==========================================
// CLICK DO BOTÃO DO GOOGLE
// ==========================================
if (btnGoogle) {
  btnGoogle.addEventListener('click', () => {
    if (isIOSStandalone) {
      alert("No aplicativo instalado no iOS, o login direto com o Google é bloqueado pela Apple. Por favor, utilize E-mail e Senha.");
      return;
    }
    btnGoogle.textContent = "Acessando...";
    btnGoogle.style.opacity = "0.7";
    signInWithRedirect(auth, provider);
  });
}

// ==========================================
// CAPTURA RETORNO DO REDIRECIONAMENTO GOOGLE
// ==========================================
getRedirectResult(auth).then((result) => {
  if (result) {
    const user = result.user;

    const userRef = doc(db, 'users', user.uid);
    getDoc(userRef).then(snap => {
      if (!snap.exists()) {
        setDoc(userRef, {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          createdAt: new Date()
        });
      }
    }).catch(e => console.log("Erro ao salvar dados de perfil:", e));

    redirectParaGaragem(user);
  }
}).catch((error) => {
  console.error("Erro capturado no retorno do Google:", error);
  if (errorMessage) {
    errorMessage.textContent = `Erro no Google (${error.code}): ${error.message}`;
    errorMessage.style.display = 'block';
  }
  if (btnGoogle) {
    btnGoogle.textContent = "Entrar com Google";
    btnGoogle.style.opacity = "1";
  }
});

// ==========================================
// RECUPERAÇÃO DE SENHA
// ==========================================
const forgotPasswordLink = document.getElementById('forgot-password-link');
const forgotPasswordModal = document.getElementById('forgot-password-modal');
const btnCloseReset = document.getElementById('btn-close-reset');
const btnSendReset = document.getElementById('btn-send-reset');
const resetEmailInput = document.getElementById('reset-email');
const resetMessage = document.getElementById('reset-message');

if (forgotPasswordLink && forgotPasswordModal) {
  forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    resetEmailInput.value = document.getElementById('email') ? document.getElementById('email').value : '';
    resetMessage.style.display = 'none';
    forgotPasswordModal.classList.add('active');
  });

  btnCloseReset.addEventListener('click', () => {
    forgotPasswordModal.classList.remove('active');
  });

  btnSendReset.addEventListener('click', async () => {
    const email = resetEmailInput.value.trim();

    if (!email) {
      showResetMessage('Por favor, digite um e-mail válido.', 'error');
      return;
    }

    const originalText = btnSendReset.textContent;
    btnSendReset.textContent = 'Enviando...';
    btnSendReset.disabled = true;

    try {
      await sendPasswordResetEmail(auth, email);
      showResetMessage('Link enviado! Verifique sua caixa de entrada (e spam).', 'success');

      setTimeout(() => {
        forgotPasswordModal.classList.remove('active');
        btnSendReset.textContent = originalText;
        btnSendReset.disabled = false;
      }, 4000);

    } catch (error) {
      console.error("Erro ao enviar reset de senha:", error);
      btnSendReset.textContent = originalText;
      btnSendReset.disabled = false;
      showResetMessage(`Erro (${error.code}): ${error.message}`, 'error');
    }
  });
}

function showResetMessage(text, type) {
  resetMessage.textContent = text;
  resetMessage.style.display = 'block';
  if (type === 'success') {
    resetMessage.style.color = '#15803d';
    resetMessage.style.backgroundColor = '#dcfce7';
    resetMessage.style.border = '1px solid #bbf7d0';
  } else {
    resetMessage.style.color = '#b91c1c';
    resetMessage.style.backgroundColor = '#fee2e2';
    resetMessage.style.border = '1px solid #fecaca';
  }
}
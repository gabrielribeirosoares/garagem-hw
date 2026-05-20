import { auth, db } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider 
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const provider = new GoogleAuthProvider();
const loginForm = document.getElementById('login-form');
const btnGoogle = document.getElementById('btn-google'); // ID do novo botão no HTML
const errorMessage = document.getElementById('error-message');
const welcomeOverlay = document.getElementById('welcome-overlay');
const welcomeMessage = document.getElementById('welcome-message');

// Função auxiliar para tratar a animação de boas-vindas e redirecionamento
async function handleLoginSuccess(user) {
  let firstName = "Colecionador";

  // Busca o nome no Firestore
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && userDoc.data().name) {
      firstName = userDoc.data().name.split(" ")[0];
    } else if (user.displayName) {
      firstName = user.displayName.split(" ")[0];
    }
  } catch (dbError) {
    console.error("Erro ao buscar nome:", dbError);
  }

  if (welcomeOverlay && welcomeMessage) {
    welcomeMessage.textContent = `Olá ${firstName}, seja muito bem-vindo(a) à sua Garagem.`;
    welcomeOverlay.classList.add('active');
    setTimeout(() => { window.location.href = 'app.html'; }, 5000);
  } else {
    window.location.href = 'app.html';
  }
}

// 1. LOGIN TRADICIONAL
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
      await handleLoginSuccess(cred.user);
    } catch (error) {
      console.error("Erro completo:", error);
      btnSubmit.textContent = originalBtnText;
      btnSubmit.disabled = false;
      if (errorMessage) {
        errorMessage.textContent = "Falha no login. Verifique o seu e-mail e palavra-passe.";
        errorMessage.style.display = 'block';
      }
    }
  });
}

// 2. LOGIN COM GOOGLE
if (btnGoogle) {
  btnGoogle.addEventListener('click', async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Cria o documento no Firestore se for o primeiro acesso do usuário Google
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          createdAt: new Date()
        });
      }

      await handleLoginSuccess(user);
    } catch (error) {
      console.error("Erro no Login Google:", error);
      alert("Erro ao logar com Google: " + error.message);
    }
  });
}
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { RAW } from './data.js'; 

const userNameEl = document.getElementById('user-firstname');

// Cards de Estatísticas
const stat1Val = document.getElementById('stat-1-val');
const stat1Label = document.getElementById('stat-1-label');
const stat2Val = document.getElementById('stat-2-val');
const stat2Label = document.getElementById('stat-2-label');

// Botões do Menu
const btnLoja = document.getElementById('btn-loja');
const btnSorteios = document.getElementById('btn-sorteios');
const btnAdmin = document.getElementById('btn-painel-admin');
const btnLogout = document.getElementById('btn-logout');

// ===================================================================
// MOTOR DE IDs RESTAURADO (Garante que os 3 modelos antigos sejam lidos)
// ===================================================================
const mapaCarrosRaw = new Map();
const idsGerados = new Set();

RAW.forEach((r) => {
  if (!r.id) {
    const cName = (r.name || "").replace(/[^a-zA-Z0-9]/g, "");
    const cColor = (r.color || "").replace(/[^a-zA-Z0-9]/g, "");
    const cPart = (r.part || "").replace(/[^a-zA-Z0-9]/g, "");

    let baseId = `hw_${r.year}_${cPart}_${cName}_${cColor}`.toLowerCase();
    let finalId = baseId;
    let counter = 1;

    while (idsGerados.has(finalId)) {
      finalId = `${baseId}_${counter}`;
      counter++;
    }
    idsGerados.add(finalId);
    r.id = finalId;
  }
  // Guarda o carro usando o ID exato que o sistema utiliza
  mapaCarrosRaw.set(r.id, r);
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      let role = 'user';
      if (userSnap.exists()) {
        const userData = userSnap.data();
        role = userData.role || 'user';
        userNameEl.textContent = userData.name ? userData.name.split(" ")[0] : (user.displayName ? user.displayName.split(" ")[0] : "Colecionador");
      } else {
        userNameEl.textContent = user.displayName ? user.displayName.split(" ")[0] : "Colecionador";
      }

      if (role === 'admin' || role === 'gerente') {
        btnAdmin.style.display = 'flex';
      }

      const colRef = doc(db, 'collections', user.uid);
      const colSnap = await getDoc(colRef);
      
      let totalHW = 0;
      let totalKaido = 0;
      let points = 0;
      
      if (colSnap.exists()) {
        const data = colSnap.data();
        points = data.points || 0;
        
        // GAVETA 1: Analisa os itens antigos e filtra a Kaido
        if (data.items) {
          Object.entries(data.items).forEach(([id, qtd]) => {
            const quantidade = parseInt(qtd) || 0;
            if (quantidade <= 0) return;

            const dadosCarroRaw = mapaCarrosRaw.get(id);
            let ehKaidoHouse = false;

            if (id.toLowerCase().includes('kaido')) {
              ehKaidoHouse = true;
            } else if (dadosCarroRaw) {
              const nomeLower = (dadosCarroRaw.name || "").toLowerCase();
              const serieLower = (dadosCarroRaw.series || "").toLowerCase();
              if (nomeLower.includes('kaido') || serieLower.includes('kaido')) {
                ehKaidoHouse = true;
              }
            }
            
            if (ehKaidoHouse) {
              totalKaido += quantidade; // Apanha os 3 antigos
            } else {
              totalHW += quantidade; // Conta apenas os verdadeiros Hot Wheels
            }
          });
        }

        // GAVETA 2: Soma a nova base exclusiva da Kaido House
        if (data.kaidoItems) {
          Object.entries(data.kaidoItems).forEach(([id, qtd]) => {
            totalKaido += (parseInt(qtd) || 0); // Apanha os 10 novos
          });
        }
      }

      // 3. Aplicação visual baseada no cargo
      if (role === 'user') {
        if (btnLoja) btnLoja.style.display = 'none';
        if (btnSorteios) btnSorteios.style.display = 'none'; 
        
        stat1Label.textContent = "Garagem HW";
        stat1Val.textContent = totalHW; // Vai exibir 138!
        
        stat2Label.textContent = "Kaido House";
        stat2Val.textContent = totalKaido; // Vai exibir 13!
        
        const highlightCardText = document.querySelector('.stat-card.highlight h3');
        if (highlightCardText) highlightCardText.style.color = '#fff';
        
      } else {
        if (btnLoja) btnLoja.style.display = 'flex';
        if (btnSorteios) btnSorteios.style.display = 'flex';
        
        stat1Label.textContent = "Na Garagem";
        stat1Val.textContent = totalHW + totalKaido; 
        
        stat2Label.textContent = "RPMs (Pontos)";
        stat2Val.textContent = points;
      }

    } catch (e) {
      console.error("Erro no processamento do painel inicial:", e);
    }
  } else {
    window.location.replace('index.html');
  }
});

if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    await signOut(auth);
    window.location.replace('index.html');
  });
}
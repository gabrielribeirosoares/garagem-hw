import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { RAW } from './data.js';

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
});

// ==========================================
// 1. ESTADO GLOBAL E ROTEAMENTO
// ==========================================
let pageType = 'all';
let PAGE_DATA = [];
let sessionUid = null;
let userCollection = {};
let sortCol = 'year';
let sortDesc = true;
let userPoints = 0;
let userMissions = {};
let userRewards = [];

let currentPage = 1;
let itemsPerPage = 50;
let lbIndex = 0;

let userAccountType = 'standalone';
let isAdmin = false;
let targetUid = null;
let targetRole = 'user';
let isManager = false;
let userHistory = [];

// ==========================================
// 2. FUNÇÕES DE ROTEAMENTO (SPA)
// ==========================================
function updatePageData() {
  PAGE_DATA = RAW.filter(r => {
    if (pageType === 'all' || pageType === 'owned') return true;
    if (pageType === 'sth' && r.series && r.series.toLowerCase().includes('super')) return true;
    if (pageType === 'th' && r.series && !r.series.toLowerCase().includes('super')) return true;
    return false;
  });
}

function updatePageUI() {
  const titleEl = document.getElementById('dynamic-title');
  const badgeEl = document.getElementById('dynamic-badge');

  if (pageType === 'all') {
    titleEl.innerHTML = 'Diecast<span>Manager</span>';
    badgeEl.style.display = 'none';
  } else if (pageType === 'sth') {
    titleEl.innerHTML = 'Diecast<span>Manager</span>';
    badgeEl.style.display = 'block';
    badgeEl.textContent = '$TH';
  } else if (pageType === 'owned') {
    titleEl.innerHTML = 'Minha <span>Coleção</span>';
    badgeEl.style.display = 'none';
  }

  document.getElementById('filter-search').value = '';
  currentPage = 1;
}

function changePage(newPageType) {
  pageType = newPageType;

  const tableArea = document.getElementById('table-body');
  const sortHeader = document.getElementById('mobile-sort') ? document.getElementById('mobile-sort').parentElement : null;

  const controlsArea = document.querySelector('.controls');
  const countArea = document.querySelector('.count-bar');
  const pagArea = document.querySelector('.pagination-container');
  const missionsArea = document.getElementById('missions-view');
  const rewardsArea = document.getElementById('rewards-view');

  // 1. CAPTURA A BARRA DE ESTATÍSTICAS
  const statsRow = document.querySelector('.stats-row');

  if (pageType === 'missions') {
    if (tableArea) tableArea.style.display = 'none';
    if (sortHeader) sortHeader.style.display = 'none';
    if (controlsArea) controlsArea.style.display = 'none';
    if (countArea) countArea.style.display = 'none';
    if (pagArea) pagArea.style.display = 'none';
    if (rewardsArea) rewardsArea.style.display = 'none';
    if (statsRow) statsRow.style.display = 'none'; // 2. ESCONDE NAS MISSÕES
    if (missionsArea) missionsArea.style.display = 'block';

    document.getElementById('dynamic-title').innerHTML = 'Garagem <span>VIP</span>';
    document.getElementById('dynamic-badge').style.display = 'none';
    renderMissions();
    return;
  } else if (pageType === 'rewards') {
    if (tableArea) tableArea.style.display = 'none';
    if (sortHeader) sortHeader.style.display = 'none';
    if (controlsArea) controlsArea.style.display = 'none';
    if (countArea) countArea.style.display = 'none';
    if (pagArea) pagArea.style.display = 'none';
    if (missionsArea) missionsArea.style.display = 'none';
    if (statsRow) statsRow.style.display = 'none'; // 3. ESCONDE NA LOJA DE RPMs
    if (rewardsArea) rewardsArea.style.display = 'block';

    document.getElementById('dynamic-title').innerHTML = 'Loja de <span>RPMs</span>';
    document.getElementById('dynamic-badge').style.display = 'none';
    renderRewards();
    return;
  } else {
    if (tableArea) tableArea.style.display = 'grid';
    if (sortHeader) sortHeader.style.display = 'flex';
    if (controlsArea) controlsArea.style.display = 'flex';
    if (countArea) countArea.style.display = 'flex';
    if (pagArea) pagArea.style.display = 'flex';
    if (missionsArea) missionsArea.style.display = 'none';
    if (rewardsArea) rewardsArea.style.display = 'none';
    if (statsRow) statsRow.style.display = 'flex'; // 4. MOSTRA NOVAMENTE NA GARAGEM
  }

  updatePageData();
  updatePageUI();
  populateFilters();
  updateCounts();
  render();
}

// ==========================================
// 3. UTILITÁRIOS
// ==========================================
function getEra(year) {
  if (year >= 2007 && year <= 2011) return 'classic';
  if (year === 2012) return 'secret';
  if (year >= 2013) return 'hidden';
  return 'other';
}

function getColor(c) {
  if (!c) return 'transparent';
  const l = c.toLowerCase();
  if (l.includes('red') || l.includes('vermelh')) return '#ef4444';
  if (l.includes('blue') || l.includes('azul')) return '#3b82f6';
  if (l.includes('green') || l.includes('verd')) return '#22c55e';
  if (l.includes('yellow') || l.includes('amarel')) return '#eab308';
  if (l.includes('black') || l.includes('pret')) return '#1f2937';
  if (l.includes('white') || l.includes('branc')) return '#f9fafb';
  if (l.includes('orange') || l.includes('laranj')) return '#f97316';
  if (l.includes('purple') || l.includes('rox')) return '#a855f7';
  if (l.includes('pink') || l.includes('rosa')) return '#ec4899';
  if (l.includes('gold') || l.includes('dourad') || l.includes('ouro')) return '#eab308';
  if (l.includes('silver') || l.includes('prata')) return '#9ca3af';
  if (l.includes('brown') || l.includes('marrom')) return '#78350f';
  return '#e5e7eb';
}

function isOwned(r) { return (userCollection[r.id] || 0) > 0; }
function getQty(r) { return userCollection[r.id] || 0; }

// ==========================================
// 4. PREENCHER FILTROS
// ==========================================
function populateFilters() {
  const years = [...new Set(PAGE_DATA.map(r => r.year))].sort((a, b) => b - a);
  const selYear = document.getElementById('filter-year');
  if (selYear) {
    selYear.innerHTML = '<option value="">Todos</option>';
    years.forEach(y => {
      if (!y) return;
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      selYear.appendChild(opt);
    });
  }

  const series = [...new Set(PAGE_DATA.map(r => r.series))].filter(Boolean).sort();
  const selSeries = document.getElementById('filter-series');
  if (selSeries) {
    selSeries.innerHTML = '<option value="">Todas</option>';
    series.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      selSeries.appendChild(opt);
    });
  }
}

// Ativa o novo menu de ordenação no mobile
const mobileSort = document.getElementById('mobile-sort');
if (mobileSort) {
  mobileSort.addEventListener('change', (e) => {
    sortCol = e.target.value;
    sortDesc = (sortCol === 'year'); // Ano é decrescente (mais novos primeiro), o resto é crescente (A-Z)
    currentPage = 1;
    render();
  });
}

function getFilteredData() {
  const searchInput = document.getElementById('filter-search');
  const yearInput = document.getElementById('filter-year');
  const eraInput = document.getElementById('filter-era');
  const seriesInput = document.getElementById('filter-series');
  const filterOwnedCheckbox = document.getElementById('filter-owned-only');

  const sq = searchInput ? searchInput.value.toLowerCase() : '';
  const sy = yearInput ? yearInput.value : '';
  const se = eraInput ? eraInput.value : '';
  const ss = seriesInput ? seriesInput.value : '';

  const isCheckboxChecked = filterOwnedCheckbox ? filterOwnedCheckbox.checked : false;
  const so = (pageType === 'owned') || isCheckboxChecked;

  let filtered = PAGE_DATA.filter(r => {
    let match = true;
    if (sq) {
      match = match && (
        (r.name && r.name.toLowerCase().includes(sq)) ||
        (r.part && r.part.toLowerCase().includes(sq)) ||
        (r.series && r.series.toLowerCase().includes(sq))
      );
    }
    if (sy) match = match && String(r.year) === sy;
    if (se) match = match && getEra(r.year) === se;
    if (ss) match = match && r.series === ss;
    if (so) match = match && isOwned(r);
    return match;
  });

  filtered.sort((a, b) => {
    let vA = a[sortCol];
    let vB = b[sortCol];

    if (sortCol === 'name' || sortCol === 'series' || sortCol === 'color' || sortCol === 'part') {
      vA = String(vA || '').toLowerCase();
      vB = String(vB || '').toLowerCase();
    }

    if (vA < vB) return sortDesc ? 1 : -1;
    if (vA > vB) return sortDesc ? -1 : 1;
    return 0;
  });

  return filtered;
}

// ==========================================
// 6. RENDERIZAÇÃO DA TABELA (HÍBRIDA E ADMIN)
// ==========================================
function render() {
  const fullData = getFilteredData();
  const tbody = document.getElementById('table-body'); // Agora é a nossa Grid
  if (!tbody) return;

  let totalPages = 1;
  let dataToRender = fullData;

  const perPageSelect = document.getElementById('per-page-select');
  const pageIndicator = document.getElementById('page-indicator');
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');

  if (perPageSelect && itemsPerPage !== 'all') {
    totalPages = Math.ceil(fullData.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    const start = (currentPage - 1) * itemsPerPage;
    dataToRender = fullData.slice(start, start + itemsPerPage);

    if (pageIndicator) {
      pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
      if (btnPrev) { btnPrev.disabled = currentPage === 1; btnPrev.style.opacity = btnPrev.disabled ? "0.5" : "1"; }
      if (btnNext) { btnNext.disabled = currentPage === totalPages; btnNext.style.opacity = btnNext.disabled ? "0.5" : "1"; }
    }
  }

  tbody.innerHTML = '';
  const visCount = document.getElementById('visible-count');
  const allCount = document.getElementById('all-count');
  if (visCount) visCount.textContent = dataToRender.length;
  if (allCount) allCount.textContent = fullData.length;

  const emptyMsg = document.getElementById('empty-msg');
  if (!dataToRender.length) {
    if (emptyMsg) {
      emptyMsg.style.display = 'block';
      if (pageType === 'owned') {
        emptyMsg.innerHTML = 'A sua coleção está vazia.<br><a href="#" data-page="all" class="menu-item" style="color:#3b82f6; text-decoration: underline;">Ir para Mostrar Tudo</a>';
        const emptyLink = emptyMsg.querySelector('a');
        if (emptyLink) emptyLink.addEventListener('click', (e) => { e.preventDefault(); changePage('all'); });
      } else { emptyMsg.textContent = 'Nenhum carro encontrado.'; }
    }
    return;
  }
  if (emptyMsg) emptyMsg.style.display = 'none';

  dataToRender.forEach((r) => {
    const globalIdx = PAGE_DATA.indexOf(r);
    const dot = getColor(r.color);
    const has = isOwned(r);

    // Cria o card em vez da linha de tabela
    const card = document.createElement('div');
    card.className = `car-card ${has ? 'owned-card' : ''}`;

    const imgCell = r.image
      ? `<img src="${r.image}" loading="lazy">`
      : `<div style="font-size:40px; color: var(--muted);">🚗</div>`;

    const qty = getQty(r);
    const repetidos = qty > 1 ? qty - 1 : 0;
    const isEditingAllowed = true;
    // Gera as opções da roda do celular (de 0 a 50 carros)
    let controlesHTML = '';
    let optionsHTML = '';
    for (let i = 0; i <= 50; i++) {
      optionsHTML += `<option value="${i}" ${i === qty ? 'selected' : ''}>${i}</option>`;
    }

    if (isEditingAllowed) {
      controlesHTML = `
        <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
          <select class="qty-input" style="width: 100%; max-width: 65px; padding: 8px; background: #0f172a; border: 1px solid #475569; color: var(--yellow); border-radius: 6px; font-weight: bold; font-size: 16px; outline: none; cursor: pointer; appearance: none; -webkit-appearance: none; text-align-last: center;">
            ${optionsHTML}
          </select>
          <button class="btn-save" style="display: none; flex: 1; padding: 8px; background: #16a34a; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Salvar</button>
          ${repetidos > 0 ? `<span class="rep-badge" style="background: #ffedd5; color: #ea580c; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 11px;">+${repetidos}</span>` : ''}
        </div>`;
    } else {
      controlesHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <span style="font-size: 20px; font-family: 'Bebas Neue'; color: ${qty > 0 ? 'var(--yellow)' : 'var(--muted)'};">${qty} na Garagem</span>
          ${repetidos > 0 ? `<span class="rep-badge" style="background: #ffedd5; color: #ea580c; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 11px;">+${repetidos}</span>` : ''}
        </div>`;
    }

    card.innerHTML = `
      <div class="car-image-container">
        <span class="year-badge">${r.year}</span>
        ${imgCell}
      </div>
      <div class="car-info">
        <div class="car-title" title="${r.name}">${r.name}</div>
        <div class="car-series">${r.series || 'Sem Série'}</div>
        <div style="display:flex; align-items:center; gap:6px; margin-bottom: 12px; font-size: 11px; color: #cbd5e1;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${dot}; box-shadow:0 0 0 1px rgba(255,255,255,0.15)"></span> ${r.color || 'N/A'}
        </div>
        <div class="car-controls">
            ${controlesHTML}
        </div>
      </div>
    `;

    // Ativa o clique na imagem para o Lightbox
    if (card.querySelector('.car-image-container') && r.image) {
      card.querySelector('.car-image-container').addEventListener('click', () => openLb(globalIdx));
    }

    tbody.appendChild(card);

    // Lógica para os botões de alterar a quantidade
    if (isEditingAllowed) {
      const inputElement = card.querySelector('.qty-input');
      const saveBtn = card.querySelector('.btn-save');
      inputElement.addEventListener('change', (e) => {
        let newVal = parseInt(e.target.value) || 0;
        saveBtn.style.display = newVal !== getQty(r) ? 'block' : 'none';
      });
      saveBtn.addEventListener('click', () => {
        saveData(r.id, parseInt(inputElement.value) || 0);
        saveBtn.style.display = 'none';
        updateCounts();
        if ((pageType === 'owned') && parseInt(inputElement.value) === 0) render();
      });
    }
  });
  window.currentFilteredData = fullData;
}

// ==========================================
// 7. ESTATÍSTICAS
// ==========================================
function updateCounts() {
  const total = PAGE_DATA.length;
  let owned = 0;
  let missing = 0;
  let dups = 0;

  PAGE_DATA.forEach(r => {
    const q = getQty(r);
    if (q > 0) {
      owned++;
      if (q > 1) dups += (q - 1);
    } else {
      missing++;
    }
  });

  const totCountEl = document.getElementById('total-count');
  const ownCountEl = document.getElementById('owned-count');
  const misCountEl = document.getElementById('missing-count');
  const dupCountEl = document.getElementById('dup-count');

  if (totCountEl) totCountEl.textContent = total;
  if (ownCountEl) ownCountEl.textContent = owned;
  if (misCountEl) misCountEl.textContent = missing;
  if (dupCountEl) dupCountEl.textContent = dups;
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    sessionUid = user.uid;

    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = user.email;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const menuAdminItem = document.getElementById('menu-admin-item');

      if (userDoc.exists()) {
        const userRole = userDoc.data().role;
        const myLojaId = userDoc.data().lojaId || ''; // Puxa a loja logada

        // Define as flags com base no cargo
        if (userRole === 'admin') isAdmin = true;
        if (userRole === 'gerente') isManager = true;

        // 1. TRAVA DO MENU ADMIN: Exibe apenas se for estritamente 'admin'
        // 1. TRAVA DO MENU ADMIN: Exibe para Admin E Gerente
        if ((isAdmin || isManager) && menuAdminItem) {
          menuAdminItem.style.display = 'block';
        } else if (menuAdminItem) {
          menuAdminItem.style.display = 'none'; // Força a ocultação para clientes
        }

        // 2. MODO VENDEDOR: Liberado para Admin E Gerente
        const adminSelector = document.getElementById('admin-client-selector');
        const clientSelect = document.getElementById('client-select');

        if ((isAdmin || isManager) && adminSelector && clientSelect) {
          adminSelector.style.display = 'flex';

          const usersSnap = await getDocs(collection(db, 'users'));
          usersSnap.forEach(docSnap => {
            const uData = docSnap.data();

            // REGRA MULTI-LOJA: Admin vê todos. Gerente só vê sua loja.
            const isMyClient = isAdmin || (isManager && uData.lojaId === myLojaId);

            // O Modo Vendedor só lista os clientes VIP daquela loja
            if (docSnap.id !== user.uid && uData.role === 'cliente' && isMyClient) {
              const opt = document.createElement('option');
              opt.value = docSnap.id;
              opt.textContent = `🛒 ${uData.name || uData.email}`;
              clientSelect.appendChild(opt);
            }
          });

          // Quando muda o cliente no dropdown
          clientSelect.addEventListener('change', async (e) => {
            targetUid = e.target.value === 'ME' ? null : e.target.value;

            const btnRifa = document.getElementById('btn-open-rifa');
            if (btnRifa) {
              btnRifa.style.display = targetUid ? 'block' : 'none';
            }

            await loadCollection();
          });
        }
      }
    } catch (error) {
      console.error("Erro ao verificar nível de acesso:", error);
    }

    await loadCollection();

  } else {
    window.location.href = 'index.html';
  }


  const isVip = (targetRole === 'cliente' || targetRole === 'admin' || isManager);
  const pointsContainer = document.getElementById('points-container');

  if (pointsContainer) {
    pointsContainer.style.display = isVip ? 'flex' : 'none';
  }

  document.querySelectorAll('[data-page="missions"], [data-page="rewards"]').forEach(el => {
    // Se for o menu lateral, exibimos para quem tem acesso ao sistema
    if (isAdmin || isManager || targetRole === 'cliente') {
      el.parentElement.style.display = 'block';
    } else {
      el.parentElement.style.display = 'none';
    }
  });
});

const btnLogoutMenu = document.getElementById('logout-menu');
if (btnLogoutMenu) {
  btnLogoutMenu.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      window.location.replace("index.html");
    } catch (error) {
      console.error("Erro ao sair:", error);
      alert("Erro ao sair da conta.");
    }
  });
}

async function loadCollection() {
  const uidToLoad = targetUid || sessionUid;
  if (!uidToLoad) return;

  try {
    const dRef = doc(db, 'collections', uidToLoad);
    const snap = await getDoc(dRef);
    if (snap.exists()) {
      userCollection = snap.data().items || {};
      userPoints = snap.data().points || 0;
      userMissions = snap.data().missions || {};
      userRewards = snap.data().rewards || [];
      userHistory = snap.data().history || [];
    } else {
      userCollection = {};
      userPoints = 0;
      userMissions = {};
      userRewards = [];
      userHistory = [];
    }

    const uRef = doc(db, 'users', uidToLoad);
    const uSnap = await getDoc(uRef);

    // Variável para descobrir a qual loja este usuário pertence
    let currentLojaId = 'default';

    if (uSnap.exists()) {
      targetRole = uSnap.data().role || 'user';
      currentLojaId = uSnap.data().lojaId || 'default'; // Puxa a etiqueta da loja
    } else {
      targetRole = 'user';
    }

    // --- NOVO: BUSCA OS PRÊMIOS EXCLUSIVOS DA LOJA ---
    try {
      const lojaRef = doc(db, 'lojas', currentLojaId);
      const lojaSnap = await getDoc(lojaRef);
      if (lojaSnap.exists() && lojaSnap.data().recompensas) {
        LISTA_RECOMPENSAS = lojaSnap.data().recompensas;
      } else {
        LISTA_RECOMPENSAS = []; // Fica vazio se a loja não tiver prêmios cadastrados
      }
    } catch (e) {
      console.error("Erro ao carregar prêmios da loja:", e);
      LISTA_RECOMPENSAS = [];
    }
    // --------------------------------------------------

    const pointsEl = document.getElementById('user-points');
    if (pointsEl) pointsEl.textContent = userPoints;

    changePage('all');
  } catch (err) {
    console.error("Erro load:", err);
    changePage('all');
  }
}

let saveTimeout = null;

const PONTOS_POR_CARRO = 100;

async function saveData(carId, qty) {
  const oldQty = userCollection[carId] || 0;
  userCollection[carId] = qty;
  const uidToSave = targetUid || sessionUid;

  // ==========================================
  // 🔒 CADEADO DE SEGURANÇA DOS PONTOS
  // ==========================================
  // Só é verdadeiro se for um Admin ou Gerente editando a conta de outra pessoa (Modo Vendedor)
  const isVendedorEditandoCliente = (isAdmin || isManager) && targetUid && targetUid !== sessionUid;

  // 1. CÁLCULO IMEDIATO (Atualiza a interface na mesma hora)
  // Adicionada a trava "isVendedorEditandoCliente" na condição!
  if (isVendedorEditandoCliente && targetRole === 'cliente' && qty > oldQty) {
    const diff = qty - oldQty;
    const pontosGanhos = diff * PONTOS_POR_CARRO;

    userPoints += pontosGanhos; // Soma na variável global

    // Atualiza o contador de RPMs lá no topo instantaneamente
    const pointsEl = document.getElementById('user-points');
    if (pointsEl) pointsEl.textContent = userPoints;

    // Lança no histórico em segundo plano
    addHistoryEntry(uidToSave, `Compra de Carros`, pontosGanhos, 'earning');
  }

  // 2. SALVAMENTO NO BANCO (Mantém o delay de 1 seg para não sobrecarregar o Firebase)
  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(async () => {
    if (!uidToSave) return;
    try {
      const dRef = doc(db, 'collections', uidToSave);
      // Salva os carros E o saldo final de pontos sincronizado
      await setDoc(dRef, { items: userCollection, points: userPoints }, { merge: true });
    } catch (e) {
      console.error("Erro save:", e);
    }
  }, 1000);
}

// ==========================================
// 9. LIGHTBOX
// ==========================================
function openLb(index) {
  lbIndex = index;
  const r = PAGE_DATA[lbIndex];
  if (!r) return;
  document.getElementById('lb-img').src = r.image;
  document.getElementById('lb-title').textContent = r.name;
  document.getElementById('lb-meta').textContent = `${r.year} | ${r.series} | ${r.color}`;
  document.getElementById('lb-counter').textContent = `${lbIndex + 1} de ${PAGE_DATA.length}`;
  document.getElementById('lightbox').style.display = 'flex';
}

function closeLb() {
  document.getElementById('lightbox').style.display = 'none';
}

const lbCloseBtn = document.getElementById('lb-close-btn');
if (lbCloseBtn) lbCloseBtn.addEventListener('click', closeLb);

const lbPrevBtn = document.getElementById('lb-prev');
if (lbPrevBtn) {
  lbPrevBtn.addEventListener('click', () => { if (lbIndex > 0) openLb(lbIndex - 1); });
}

const lbNextBtn = document.getElementById('lb-next');
if (lbNextBtn) {
  lbNextBtn.addEventListener('click', () => { if (lbIndex < PAGE_DATA.length - 1) openLb(lbIndex + 1); });
}

document.addEventListener('keydown', (e) => {
  const lightbox = document.getElementById('lightbox');
  if (lightbox && lightbox.style.display === 'flex') {
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft' && lbIndex > 0) openLb(lbIndex - 1);
    if (e.key === 'ArrowRight' && lbIndex < PAGE_DATA.length - 1) openLb(lbIndex + 1);
  }
});

// ==========================================
// 10. INICIALIZAÇÃO E EVENTOS
// ==========================================

document.querySelectorAll('.sidebar-menu a[data-page]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetPage = e.target.getAttribute('data-page');
    changePage(targetPage);

    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  });
});

const menuBtn = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');
const closeBtn = document.getElementById('close-sidebar');

function openMenu() { if (sidebar) sidebar.classList.add('open'); if (overlay) overlay.classList.add('open'); }
function closeMenu() { if (sidebar) sidebar.classList.remove('open'); if (overlay) overlay.classList.remove('open'); }

if (menuBtn) menuBtn.addEventListener('click', openMenu);
if (closeBtn) closeBtn.addEventListener('click', closeMenu);
if (overlay) overlay.addEventListener('click', closeMenu);

document.querySelectorAll('th[data-col]').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.getAttribute('data-col');
    if (sortCol === col) {
      sortDesc = !sortDesc;
    } else {
      sortCol = col;
      sortDesc = false;
    }
    document.querySelectorAll('th').forEach(t => t.classList.remove('sorted'));
    th.classList.add('sorted');
    document.querySelectorAll('.sort-icon').forEach(icon => icon.textContent = '↕');
    th.querySelector('.sort-icon').textContent = sortDesc ? '↓' : '↑';
    currentPage = 1;
    render();
  });
});

const searchInput = document.getElementById('filter-search');
const yearInput = document.getElementById('filter-year');
const eraInput = document.getElementById('filter-era');
const seriesInput = document.getElementById('filter-series');
const filterOwnedCheckbox = document.getElementById('filter-owned-only');

if (searchInput) searchInput.addEventListener('input', () => { currentPage = 1; render(); });
if (yearInput) yearInput.addEventListener('change', () => { currentPage = 1; render(); });
if (eraInput) eraInput.addEventListener('change', () => { currentPage = 1; render(); });
if (seriesInput) seriesInput.addEventListener('change', () => { currentPage = 1; render(); });
if (filterOwnedCheckbox) filterOwnedCheckbox.addEventListener('change', () => { currentPage = 1; render(); });

const btnClear = document.getElementById('btn-clear');
if (btnClear) {
  btnClear.addEventListener('click', () => {
    currentPage = 1;
    if (searchInput) searchInput.value = '';
    if (yearInput) yearInput.value = '';
    if (eraInput) eraInput.value = '';
    if (seriesInput) seriesInput.value = '';
    if (filterOwnedCheckbox) filterOwnedCheckbox.checked = false;
    render();
  });
}

const perPageSelect = document.getElementById('per-page-select');
if (perPageSelect) {
  perPageSelect.addEventListener('change', (e) => {
    itemsPerPage = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
    currentPage = 1;
    render();
  });
}

const btnPrev = document.getElementById('btn-prev-page');
if (btnPrev) {
  btnPrev.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      render();
    }
  });
}

const btnNext = document.getElementById('btn-next-page');
if (btnNext) {
  btnNext.addEventListener('click', () => {
    const maxPages = itemsPerPage === 'all' ? 1 : Math.ceil((window.currentFilteredData || []).length / itemsPerPage);
    if (currentPage < maxPages) {
      currentPage++;
      render();
    }
  });
}

// ==========================================
// MOTOR DE MISSÕES E GAMIFICAÇÃO
// ==========================================
const LISTA_MISSOES = [
  {
    id: 'j-imports_2026',
    ano: 2026,
    serie: 'j-imports',
    badge: 'Mestre Japonês 2026',
    titulo: 'Série HW J-Imports (2026)',
    descricao: 'Complete a coleção de miniaturas da série HW J-Imports lançados no ano de 2026.',
    recompensa: 500,
    fallbackTotal: 10
  },
  {
    id: 'batman_2026',
    ano: 2026,
    serie: 'batman',
    badge: 'Cavaleiro de Gotham',
    titulo: 'Série Batman (2026)',
    descricao: 'Complete a coleção de miniaturas do Batman lançadas no ano de 2026.',
    recompensa: 300,
    fallbackTotal: 5
  },
  {
    id: 'exoticars',
    ano: 2026,
    serie: 'exoticars',
    badge: 'Magnata do Asfalto',
    titulo: 'Série Exoticars (2026)',
    descricao: 'Reúna os hipercarros e supercarros mais exclusivos do mundo lançados em 2026.',
    recompensa: 500,
    fallbackTotal: 5
  }
];

function renderMissions() {
  const container = document.getElementById('missions-view');
  if (!container) return;

  let cardsHTML = '';

  LISTA_MISSOES.forEach(missao => {
    const carrosDaMissao = RAW.filter(r =>
      r.series && r.series.toLowerCase().includes(missao.serie.toLowerCase()) &&
      r.year === parseInt(missao.ano)
    );

    const totalTarget = carrosDaMissao.length > 0 ? carrosDaMissao.length : missao.fallbackTotal;
    const carrosOwned = carrosDaMissao.filter(r => isOwned(r)).length;

    const pct = Math.min(100, Math.round((carrosOwned / totalTarget) * 100));
    const isComplete = carrosOwned >= totalTarget;
    const isClaimed = userMissions[missao.id];

    let btnHTML = '';
    if (isClaimed) {
      btnHTML = `<button disabled class="btn-mission claimed">✅ Recompensa Resgatada</button>`;
    } else if (isComplete) {
      btnHTML = `<button class="btn-mission claim" onclick="window.claimMission('${missao.id}', ${missao.recompensa})">🎁 Resgatar ${missao.recompensa} RPMs</button>`;
    } else {
      btnHTML = `<button class="btn-mission search" onclick="
        document.querySelector('[data-page=\\'all\\']').click();
        setTimeout(() => {
          const searchInput = document.getElementById('filter-search');
          const yearInput = document.getElementById('filter-year');

          if (searchInput) {
              searchInput.value = '${missao.serie}';
              searchInput.dispatchEvent(new Event('input'));
          }
          if (yearInput) {
              const opt = Array.from(yearInput.options).find(o => o.value == '${missao.ano}');
              if (opt) {
                  yearInput.value = '${missao.ano}';
                  yearInput.dispatchEvent(new Event('change'));
              }
          }
        }, 150);
      ">Procurar Modelos ${missao.ano}</button>`;
    }

    cardsHTML += `
      <div class="mission-card">
          <div class="mission-badge">${missao.badge}</div>
          <h3>${missao.titulo}</h3>
          <p>${missao.descricao}</p>

          <div class="progress-wrap" style="margin-top: auto;">
              <div class="progress-stats">
                  <span>Seu Progresso</span>
                  <span style="color: ${isComplete ? 'var(--green)' : 'var(--yellow)'}">${carrosOwned} / ${totalTarget}</span>
              </div>
              <div class="progress-bg"><div class="progress-fill" style="width: ${pct}%"></div></div>
          </div>

          <div style="margin-top: 16px;">
            ${btnHTML}
          </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="mission-header">
        <h2>Desafios da Coleção</h2>
        <p>Complete as séries listadas abaixo comprando pela loja e ganhe RPMs para trocar por frete grátis, protetores e miniaturas soltas.</p>
    </div>
    <div class="mission-grid">
        ${cardsHTML}
    </div>
  `;
}

window.claimMission = async function (missionId, rewardPoints) {
  if (!sessionUid) return;

  userPoints += rewardPoints;
  userMissions[missionId] = true;

  const pointsEl = document.getElementById('user-points');
  if (pointsEl) pointsEl.textContent = userPoints;

  renderMissions();

  try {
    await setDoc(doc(db, 'collections', sessionUid), {
      points: userPoints,
      missions: userMissions
    }, { merge: true });
    showModal('success', { title: "Missão Concluída!", code: `+${rewardPoints} RPMs` });
  } catch (e) {
    console.error("Erro ao resgatar missão:", e);
    showModal('error', { text: "Erro ao validar pontos com o servidor." });
  }
}

// ==========================================
// LOJA DE RESGATE (REWARDS)
// ==========================================
let LISTA_RECOMPENSAS = [];

async function renderRewards() {
  const container = document.getElementById('rewards-view');
  if (!container) return;

  let cardsHTML = '';
  LISTA_RECOMPENSAS.forEach(item => {
    const canAfford = userPoints >= item.custo;
    cardsHTML += `
      <div class="reward-card">
          <div class="reward-icon">${item.icone}</div>
          <h3>${item.titulo}</h3>
          <p>${item.desc}</p>
          <div class="reward-cost">🪙 ${item.custo} RPMs</div>
          <button class="btn-redeem" ${!canAfford ? 'disabled' : ''} onclick="window.redeemReward('${item.id}', ${item.custo}, '${item.titulo}')">
            ${canAfford ? 'Resgatar Prêmio' : 'Pontos Insuficientes'}
          </button>
      </div>
    `;
  });

  // --- TABELA DE CUPONS (EXISTENTE) ---
  let cuponsHTML = '';
  if (userRewards && userRewards.length > 0) {
    let linhasCupons = userRewards.map(resgate => `
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 12px; font-family: 'Barlow Condensed', sans-serif; font-weight: 600; color: #fff;">${resgate.data}</td>
        <td style="padding: 12px; color: var(--yellow); font-weight: 500; font-size: 14px;">${resgate.titulo}</td>
        <td style="padding: 12px;"><span style="font-family: monospace; background: var(--surface2); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); color: #fff; font-size: 13px; letter-spacing: 1px;">${resgate.codigo}</span></td>
        <td style="padding: 12px;"><span style="background: rgba(34, 197, 94, 0.15); color: var(--green); border: 1px solid rgba(34, 197, 94, 0.3); padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase;">${resgate.status}</span></td>
      </tr>
    `).join('');

    cuponsHTML = `
      <div style="margin-top: 40px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px;">
        <h3 style="font-family: 'Bebas Neue', sans-serif; font-size: 26px; color: #fff; margin-bottom: 16px;">🎟️ Meus Cupons</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <thead><tr style="border-bottom: 2px solid var(--border); color: var(--muted); font-size: 11px;">
                <th style="padding: 12px; text-transform: uppercase;">Data</th>
                <th style="padding: 12px; text-transform: uppercase;">Prêmio</th>
                <th style="padding: 12px; text-transform: uppercase;">Código</th>
                <th style="padding: 12px; text-transform: uppercase;">Status</th>
            </tr></thead>
            <tbody>${linhasCupons}</tbody>
        </table>
      </div>
    `;
  }

  // --- TABELA DE EXTRATO (NOVO) ---
  let extratoHTML = '';
  if (userHistory && userHistory.length > 0) {
    let linhasExtrato = userHistory.map(item => `
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 10px; color: var(--muted); font-size: 13px;">${item.date}</td>
        <td style="padding: 10px; color: #fff; font-size: 14px;">${item.desc}</td>
        <td style="padding: 10px; font-weight: bold; color: ${item.type === 'earning' ? 'var(--green)' : 'var(--red)'}; text-align: right; font-family: 'Barlow Condensed', sans-serif;">
            ${item.type === 'earning' ? '+' : '-'}${item.amount}
        </td>
      </tr>
    `).join('');

    extratoHTML = `
      <div style="margin-top: 40px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px;">
        <h3 style="font-family: 'Bebas Neue', sans-serif; font-size: 26px; color: #fff; margin-bottom: 16px;">📊 Extrato de RPMs</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>${linhasExtrato}</tbody>
        </table>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="mission-header">
        <h2>Troque seus Pontos</h2>
        <p>Seu saldo atual é de <strong style="color: var(--yellow); font-size: 18px;">🪙 ${userPoints} RPMs</strong>.</p>
    </div>
    <div class="reward-grid">
        ${cardsHTML}
    </div>
    ${cuponsHTML}
    ${extratoHTML}
  `;
}

// ==========================================
// SISTEMA DE MODAIS (POP-UPS)
// ==========================================
function showModal(type, options) {
  const existingModal = document.getElementById('hw-custom-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'hw-custom-modal';
  modal.className = 'custom-modal-overlay';

  let innerHTML = '';

  if (type === 'error') {
    innerHTML = `
      <div class="custom-modal-box">
        <div class="custom-modal-icon">⚠️</div>
        <div class="custom-modal-title" style="color: var(--red);">Oops!</div>
        <div class="custom-modal-text">${options.text}</div>
        <div class="custom-modal-actions">
          <button class="btn-modal cancel" onclick="document.getElementById('hw-custom-modal').remove()">Fechar</button>
        </div>
      </div>
    `;
  }
  else if (type === 'confirm') {
    innerHTML = `
      <div class="custom-modal-box">
        <div class="custom-modal-icon">❓</div>
        <div class="custom-modal-title">Confirmar Resgate</div>
        <div class="custom-modal-text">Deseja gastar <b>${options.cost} RPMs</b> para resgatar o prêmio "<b style="color:#fff">${options.title}</b>"?</div>
        <div class="custom-modal-actions">
          <button class="btn-modal cancel" onclick="document.getElementById('hw-custom-modal').remove()">Cancelar</button>
          <button class="btn-modal confirm" id="btn-modal-confirm">Sim, Resgatar</button>
        </div>
      </div>
    `;
  }
  else if (type === 'success') {
    const msgWpp = encodeURIComponent(`Fala mestre! Acabei de resgatar o prêmio "${options.title}" lá no site. Meu cupom é: ${options.code}`);

    innerHTML = `
      <div class="custom-modal-box">
        <div class="custom-modal-icon">🎉</div>
        <div class="custom-modal-title" style="color: var(--green);">SUCESSO!</div>
        <div class="custom-modal-text">O prêmio "<b>${options.title}</b>" é seu! Salve o código abaixo:</div>
        <div class="custom-modal-code">${options.code}</div>
        <div class="custom-modal-actions">
          <a href="https://wa.me/5548991348421?text=${msgWpp}" target="_blank" class="btn-modal whatsapp">📱 Enviar no Whats</a>
          <button class="btn-modal cancel" onclick="document.getElementById('hw-custom-modal').remove()">Fechar</button>
        </div>
      </div>
    `;
  }

  modal.innerHTML = innerHTML;
  document.body.appendChild(modal);

  if (type === 'confirm') {
    document.getElementById('btn-modal-confirm').addEventListener('click', () => {
      modal.remove();
      if (options.onConfirm) options.onConfirm();
    });
  }
}

window.redeemReward = function (rewardId, cost, title) {
  if (!sessionUid) return;

  if (userPoints < cost) {
    showModal('error', { text: "Você não tem RPMs suficientes na garagem para resgatar este item." });
    return;
  }

  showModal('confirm', {
    cost: cost,
    title: title,
    onConfirm: async () => {

      userPoints -= cost;

      const randomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
      const couponCode = `HW-${randomCode}`;

      const novoCupom = {
        id: rewardId,
        titulo: title,
        data: new Date().toLocaleDateString('pt-BR'),
        codigo: couponCode,
        status: 'Disponível'
      };

      userRewards.unshift(novoCupom);

      const pointsEl = document.getElementById('user-points');
      if (pointsEl) pointsEl.textContent = userPoints;
      renderRewards();

      try {
        await setDoc(doc(db, 'collections', sessionUid), {
          points: userPoints,
          rewards: userRewards
        }, { merge: true });

        await addHistoryEntry(sessionUid, `Resgate: ${title}`, cost, 'spending');

        showModal('success', { title: title, code: couponCode });

      } catch (e) {
        console.error("Erro ao salvar resgate:", e);
        showModal('error', { text: "Houve uma falha de conexão com o servidor. Seus pontos foram devolvidos." });

        userPoints += cost;
        userRewards.shift();
        if (pointsEl) pointsEl.textContent = userPoints;
        renderRewards();
      }
    }
  });
}

// ==========================================
// SISTEMA DE RIFAS (MODO VENDEDOR)
// ==========================================
const btnOpenRifa = document.getElementById('btn-open-rifa');
const btnSaveRifa = document.getElementById('btn-save-rifa');
const rifaModal = document.getElementById('rifa-modal');

if (btnOpenRifa) {
  btnOpenRifa.addEventListener('click', () => {
    if (targetRole !== 'cliente' && !isAdmin && !isManager) {
      alert("Esta conta ainda é um 'Usuário' comum e não permite acúmulo de pontos. Mude o cargo no Painel Admin se desejar.");
      return;
    }

    document.getElementById('rifa-qty-input').value = 1;
    document.getElementById('rifa-points-per-num').value = 50;
    rifaModal.style.display = 'flex';
  });
}

if (btnSaveRifa) {
  btnSaveRifa.addEventListener('click', async () => {
    if (!targetUid) return;

    const qtyInput = parseInt(document.getElementById('rifa-qty-input').value) || 0;
    const pointsPerNum = parseInt(document.getElementById('rifa-points-per-num').value) || 0;

    if (qtyInput <= 0 || pointsPerNum <= 0) {
      alert("Por favor, preencha valores maiores que zero.");
      return;
    }

    btnSaveRifa.textContent = "Creditando...";
    btnSaveRifa.disabled = true;

    try {
      const pontosGanhos = qtyInput * pointsPerNum;

      // Atualiza a variável de pontos localmente (que já reflete a conta do cliente)
      userPoints += pontosGanhos;

      // Salva a nova soma no banco do cliente que você selecionou no dropdown
      await setDoc(doc(db, 'collections', targetUid), {
        points: userPoints
      }, { merge: true });

      // Após await setDoc(...) no btnSaveRifa:
      await addHistoryEntry(targetUid, `Lançamento de Rifa`, pontosGanhos, 'earning');

      // Atualiza o contador de RPMs no cabeçalho na mesma hora
      const pointsEl = document.getElementById('user-points');
      if (pointsEl) pointsEl.textContent = userPoints;

      // Se você estiver com a página da loja aberta, recarrega para liberar os botões de prêmio
      if (pageType === 'rewards') renderRewards();

      alert(`🎉 SUCESSO!\n\nForam creditados +${pontosGanhos} RPMs na conta do cliente!`);

      rifaModal.style.display = 'none';
      btnSaveRifa.textContent = "🪙 Creditar Pontos";
      btnSaveRifa.disabled = false;

    } catch (error) {
      console.error("Erro ao creditar pontos da rifa:", error);
      alert("Houve uma falha de conexão ao salvar os pontos.");
      btnSaveRifa.textContent = "🪙 Creditar Pontos";
      btnSaveRifa.disabled = false;
    }
  });
}

// Função para registrar histórico de pontos
async function addHistoryEntry(uid, desc, amount, type) {
  try {
    const ref = doc(db, 'collections', uid);
    const snap = await getDoc(ref);
    const currentData = snap.exists() ? snap.data() : { history: [] };
    const history = currentData.history || [];

    history.unshift({
      date: new Date().toLocaleDateString('pt-BR'),
      desc: desc,
      amount: amount,
      type: type
    });

    await setDoc(ref, { history: history }, { merge: true });

    userHistory = history;
    if (pageType === 'rewards') renderRewards();
  } catch (e) {
    console.error("Erro ao registrar histórico:", e);
  }
}
// NÃO ADICIONE NENHUMA CHAVE EXTRA APÓS ESTA LINHA
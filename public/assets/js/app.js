import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { RAW } from './data.js';
import { KAIDO_DATA } from './data_kaido.js';

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




let pageType = 'all';
let PAGE_DATA = [];
let sessionUid = null;
let userCollection = {};
let userKaidoCollection = {};
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

let userWishlist = {};

const urlParams = new URLSearchParams(window.location.search);
const publicGarageUid = urlParams.get('garagem');
const isPublicView = !!publicGarageUid;




function updatePageData() {
  PAGE_DATA = RAW.filter(r => {
    if (pageType === 'all' || pageType === 'owned') return true;
    if (pageType === 'sth' && r.series && r.series.toLowerCase().includes('super')) return true;
    if (pageType === 'th' && r.series && !r.series.toLowerCase().includes('super')) return true;
    // Ensina o sistema a mostrar os carros curtidos na página da wishlist
    if (pageType === 'wishlist' && userWishlist[r.id]) return true;
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
  } else if (pageType === 'wishlist') {
    titleEl.innerHTML = 'Lista de <span>Desejos</span>';
    badgeEl.style.display = 'block';
    badgeEl.textContent = '❤️';
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
  const kaidoArea = document.getElementById('kaido-view');
  const statsRow = document.querySelector('.stats-row');
  const statsArea = document.getElementById('stats-view');


  if (pageType === 'kaido' || pageType === 'kaido-owned') {
    updateSidebarVisibility('kaido');
  } else {
    updateSidebarVisibility('hw');
  }

  // Roteamento
  if (pageType === 'missions') {
    if (tableArea) tableArea.style.display = 'none';
    if (sortHeader) sortHeader.style.display = 'none';
    if (controlsArea) controlsArea.style.display = 'none';
    if (countArea) countArea.style.display = 'none';
    if (pagArea) pagArea.style.display = 'none';
    if (rewardsArea) rewardsArea.style.display = 'none';
    if (kaidoArea) kaidoArea.style.display = 'none';
    if (statsRow) statsRow.style.display = 'none';
    if (statsArea) statsArea.style.display = 'none';
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
    if (kaidoArea) kaidoArea.style.display = 'none';
    if (statsRow) statsRow.style.display = 'none';
    if (statsArea) statsArea.style.display = 'none';
    if (rewardsArea) rewardsArea.style.display = 'block';

    document.getElementById('dynamic-title').innerHTML = 'Loja de <span>RPMs</span>';
    document.getElementById('dynamic-badge').style.display = 'none';
    renderRewards();
    return;

  } else if (pageType === 'kaido' || pageType === 'kaido-owned' || pageType === 'kaido-wishlist') {
    if (tableArea) tableArea.style.display = 'none';
    if (sortHeader) sortHeader.style.display = 'none';
    if (controlsArea) controlsArea.style.display = 'none';
    if (countArea) countArea.style.display = 'none';
    if (pagArea) pagArea.style.display = 'none';
    if (missionsArea) missionsArea.style.display = 'none';
    if (rewardsArea) rewardsArea.style.display = 'none';
    if (statsRow) statsRow.style.display = 'none';
    if (statsArea) statsArea.style.display = 'none';
    if (kaidoArea) kaidoArea.style.display = 'block';

    // Muda o título de acordo com o menu clicado
    if (pageType === 'kaido-owned') {
      document.getElementById('dynamic-title').innerHTML = 'Minha Coleção <span>Kaido</span>';
    } else if (pageType === 'kaido-wishlist') {
      document.getElementById('dynamic-title').innerHTML = 'Lista de desejos <span>Kaido</span>';
    } else {
      document.getElementById('dynamic-title').innerHTML = 'Kaido <span>House</span>';
    }

    document.getElementById('dynamic-badge').style.display = 'none';

    // Passa o pageType para a função renderKaido
    renderKaido(pageType);
    return;

  } else if (pageType === 'stats') {
    if (tableArea) tableArea.style.display = 'none';
    if (sortHeader) sortHeader.style.display = 'none';
    if (controlsArea) controlsArea.style.display = 'none';
    if (countArea) countArea.style.display = 'none';
    if (pagArea) pagArea.style.display = 'none';
    if (missionsArea) missionsArea.style.display = 'none';
    if (rewardsArea) rewardsArea.style.display = 'none';
    if (kaidoArea) kaidoArea.style.display = 'none';
    if (statsRow) statsRow.style.display = 'none';
    if (statsArea) statsArea.style.display = 'block';

    document.getElementById('dynamic-title').innerHTML = 'Meu <span>Dashboard</span>';
    document.getElementById('dynamic-badge').style.display = 'none';
    if (window.renderStats) window.renderStats();
    return;

  } else {

    if (tableArea) tableArea.style.display = 'grid';
    if (sortHeader) sortHeader.style.display = 'flex';
    if (controlsArea) controlsArea.style.display = 'flex';
    if (countArea) countArea.style.display = 'flex';
    if (pagArea) pagArea.style.display = 'flex';
    if (missionsArea) missionsArea.style.display = 'none';
    if (rewardsArea) rewardsArea.style.display = 'none';
    if (kaidoArea) kaidoArea.style.display = 'none';
    if (statsArea) statsArea.style.display = 'none';
    if (statsRow) statsRow.style.display = 'flex';
  }

  updatePageData();
  updatePageUI();
  populateFilters();
  updateCounts();
  render();
}




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


const mobileSort = document.getElementById('mobile-sort');
if (mobileSort) {
  mobileSort.addEventListener('change', (e) => {
    sortCol = e.target.value;
    sortDesc = (sortCol === 'year');
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

    // Limpa espaços acidentais (.trim) e ignora maiúsculas/minúsculas
    if (sortCol === 'name' || sortCol === 'series' || sortCol === 'color' || sortCol === 'part' || sortCol === 'cas') {
      vA = String(vA || '').trim().toLowerCase();
      vB = String(vB || '').trim().toLowerCase();
    }

    // 🔒 REGRA ESPECIAL PARA ORDENAÇÃO DE LOTE
    if (sortCol === 'cas') {
      // 1. Se um carro não tem lote, joga ele para o final da lista
      if (vA === '' && vB !== '') return 1;
      if (vA !== '' && vB === '') return -1;

      // 2. Se os dois carros são do MESMO lote, desempata pelo Nome do Carro (A-Z)
      if (vA === vB) {
        let nA = String(a.name || '').trim().toLowerCase();
        let nB = String(b.name || '').trim().toLowerCase();
        if (nA < nB) return -1;
        if (nA > nB) return 1;
        return 0;
      }
    }

    // Ordenação padrão para os outros filtros
    if (vA < vB) return sortDesc ? 1 : -1;
    if (vA > vB) return sortDesc ? -1 : 1;
    return 0;
  });

  return filtered;
}

function render() {
  const fullData = getFilteredData();
  const tbody = document.getElementById('table-body');
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


    const card = document.createElement('div');
    card.className = `car-card ${has ? 'owned-card' : ''}`;

    const imgCell = r.image
      ? `<img src="${r.image}" loading="lazy">`
      : `<div style="font-size:40px; color: var(--muted);">🚗</div>`;

    const qty = getQty(r);
    const repetidos = qty > 1 ? qty - 1 : 0;
    const isEditingAllowed = !isPublicView;

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

    // Cria a etiqueta (badge) do Lote se existir, posicionada no canto superior direito
    const loteBadge = r.cas
      ? `<span style="position: absolute; top: 8px; right: 8px; background: #334155; color: #f8fafc; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; border: 1px solid #475569; z-index: 2; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">LOTE ${r.cas}</span>`
      : '';

    card.innerHTML = `
      <div class="car-image-container" style="position: relative;">
        <span class="year-badge">${r.year}</span>
        ${loteBadge}
        ${imgCell}
      </div>
      <div class="car-info">
        
        <div style="display: flex; justify-content: space-between; align-items: start;">
            <div class="car-title" title="${r.name}">${r.name}</div>
            <button id="wish-${r.id}" onclick="toggleWishlist('${r.id}')" style="background: none; border: none; font-size: 18px; cursor: pointer; padding: 0 0 0 8px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); transition: transform 0.2s;">
                ${userWishlist[r.id] ? '❤️' : '🤍'}
            </button>
        </div>
        
        <div class="car-series">${r.series || 'Sem Série'}</div>
        <div style="display:flex; align-items:center; gap:6px; margin-bottom: 12px; font-size: 11px; color: #cbd5e1;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${dot}; box-shadow:0 0 0 1px rgba(255,255,255,0.15)"></span> ${r.color || 'N/A'}
        </div>
        <div class="car-controls">
            ${controlesHTML}
        </div>
      </div>
    `;


    if (card.querySelector('.car-image-container') && r.image) {
      card.querySelector('.car-image-container').addEventListener('click', () => openLb(globalIdx));
    }

    tbody.appendChild(card);


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
        const myLojaId = userDoc.data().lojaId || '';


        if (userRole === 'admin') isAdmin = true;
        if (userRole === 'gerente') isManager = true;



        if ((isAdmin || isManager) && menuAdminItem) {
          menuAdminItem.style.display = 'block';
        } else if (menuAdminItem) {
          menuAdminItem.style.display = 'none';
        }


        const adminSelector = document.getElementById('admin-client-selector');
        const clientSelect = document.getElementById('client-select');

        if ((isAdmin || isManager) && adminSelector && clientSelect) {
          adminSelector.style.display = 'flex';

          const usersSnap = await getDocs(collection(db, 'users'));
          usersSnap.forEach(docSnap => {
            const uData = docSnap.data();


            const isMyClient = isAdmin || (isManager && uData.lojaId === myLojaId);


            if (docSnap.id !== user.uid && uData.role === 'cliente' && isMyClient) {
              const opt = document.createElement('option');
              opt.value = docSnap.id;
              opt.textContent = `🛒 ${uData.name || uData.email}`;
              clientSelect.appendChild(opt);
            }
          });


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
  const uidToLoad = publicGarageUid || targetUid || sessionUid;
  if (!uidToLoad) return;

  try {
    const dRef = doc(db, 'collections', uidToLoad);
    const snap = await getDoc(dRef);
    if (snap.exists()) {
      userCollection = snap.data().items || {};
      userKaidoCollection = snap.data().kaidoItems || {};
      userPoints = snap.data().points || 0;
      userMissions = snap.data().missions || {};
      userRewards = snap.data().rewards || [];
      userHistory = snap.data().history || [];
      userWishlist = snap.data().wishlist || {};
    } else {
      userCollection = {};
      userKaidoCollection = {};
      userPoints = 0;
      userMissions = {};
      userRewards = [];
      userHistory = [];
    }

    const uRef = doc(db, 'users', uidToLoad);
    const uSnap = await getDoc(uRef);


    let currentLojaId = 'default';

    if (uSnap.exists()) {
      targetRole = uSnap.data().role || 'user';
      currentLojaId = uSnap.data().lojaId || 'default';
    } else {
      targetRole = 'user';
    }


    try {
      const lojaRef = doc(db, 'lojas', currentLojaId);
      const lojaSnap = await getDoc(lojaRef);
      if (lojaSnap.exists() && lojaSnap.data().recompensas) {
        LISTA_RECOMPENSAS = lojaSnap.data().recompensas;
      } else {
        LISTA_RECOMPENSAS = [];
      }
    } catch (e) {
      console.error("Erro ao carregar prêmios da loja:", e);
      LISTA_RECOMPENSAS = [];
    }


    const pointsEl = document.getElementById('user-points');
    if (pointsEl) pointsEl.textContent = userPoints;

    changePage('all');
  } catch (err) {
    console.error("Erro load:", err);
    changePage('all');
  }
}

let saveTimeout = null;
let saveKaidoTimeout = null;

const PONTOS_POR_CARRO = 100;

async function saveData(carId, qty) {
  const oldQty = userCollection[carId] || 0;
  userCollection[carId] = qty;
  const uidToSave = targetUid || sessionUid;

  const isVendedorEditandoCliente = (isAdmin || isManager) && targetUid && targetUid !== sessionUid;

  if (isVendedorEditandoCliente && targetRole === 'cliente' && qty > oldQty) {
    const diff = qty - oldQty;
    const pontosGanhos = diff * PONTOS_POR_CARRO;
    userPoints += pontosGanhos;
    const pointsEl = document.getElementById('user-points');
    if (pointsEl) pointsEl.textContent = userPoints;
    addHistoryEntry(uidToSave, `Compra de Carros`, pontosGanhos, 'earning');
  }

  if (qty > 0 && userWishlist[carId]) {
    userWishlist[carId] = false;
    const btnWish = document.getElementById(`wish-${carId}`);
    if (btnWish) btnWish.innerHTML = '🤍';
    if (typeof pageType !== 'undefined' && pageType === 'wishlist') {
      setTimeout(() => {
        updatePageData();
        render();
      }, 50);
    }
  }


  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (!uidToSave) return;
    try {
      const dRef = doc(db, 'collections', uidToSave);

      await setDoc(dRef, { items: userCollection, points: userPoints, wishlist: userWishlist }, { merge: true });
    } catch (e) {
      console.error("Erro save:", e);
    }
  }, 1000);
}

window.saveKaidoData = async function (codigo, qty) {
  const oldQty = userKaidoCollection[codigo] || 0;
  userKaidoCollection[codigo] = qty;
  const uidToSave = targetUid || sessionUid;

  const isVendedorEditandoCliente = (isAdmin || isManager) && targetUid && targetUid !== sessionUid;

  if (isVendedorEditandoCliente && targetRole === 'cliente' && qty > oldQty) {
    const diff = qty - oldQty;
    const pontosGanhos = diff * PONTOS_POR_CARRO;
    userPoints += pontosGanhos;
    const pointsEl = document.getElementById('user-points');
    if (pointsEl) pointsEl.textContent = userPoints;
    addHistoryEntry(uidToSave, `Adição Kaido House`, pontosGanhos, 'earning');
  }

  if (qty > 0 && userWishlist[codigo]) {
    userWishlist[codigo] = false;
    const btnWish = document.getElementById(`wish-${codigo}`);
    if (btnWish) btnWish.innerHTML = '🤍';
    if (typeof showingOnlyWishlistKaido !== 'undefined' && showingOnlyWishlistKaido) {
      setTimeout(() => window.renderKaidoGrid(), 50);
    }
  }

  if (saveKaidoTimeout) clearTimeout(saveKaidoTimeout);
  saveKaidoTimeout = setTimeout(async () => {
    if (!uidToSave) return;
    try {
      const dRef = doc(db, 'collections', uidToSave);

      await setDoc(dRef, { kaidoItems: userKaidoCollection, points: userPoints, wishlist: userWishlist }, { merge: true });
    } catch (e) {
      console.error("Erro ao salvar Kaido:", e);
    }
  }, 1000);
};


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
          <a href="https:
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


      userPoints += pontosGanhos;


      await setDoc(doc(db, 'collections', targetUid), {
        points: userPoints
      }, { merge: true });


      await addHistoryEntry(targetUid, `Lançamento de Rifa`, pontosGanhos, 'earning');


      const pointsEl = document.getElementById('user-points');
      if (pointsEl) pointsEl.textContent = userPoints;


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


window.kaidoCurrentPage = 1;
window.kaidoItemsPerPage = 25;
let showingOnlyOwnedKaido = false;
let showingOnlyWishlistKaido = false;

window.renderKaido = function (currentPageType = 'kaido') {
  // Define os filtros com base na página que veio do menu
  showingOnlyOwnedKaido = (currentPageType === 'kaido-owned');
  showingOnlyWishlistKaido = (currentPageType === 'kaido-wishlist');

  const container = document.getElementById('kaido-view');
  if (!container) return;

  if (!document.getElementById('kaido-search')) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 25px; flex-wrap: wrap; gap: 10px;">
          <h2 style="font-family: 'Bebas Neue', sans-serif; color: #fff; font-size: 32px; margin: 0; letter-spacing: 1px;">Catálogo Kaido House</h2>
          <span id="kaido-count-badge" style="background: rgba(192, 132, 252, 0.15); color: #c084fc; padding: 6px 12px; border-radius: 6px; font-weight: bold; border: 1px solid #c084fc; font-family: 'Barlow Condensed', sans-serif;">${KAIDO_DATA.length} Modelos</span>
      </div>
      
      <div style="margin-bottom: 15px;">
          <input type="text" id="kaido-search" placeholder="🔍 Buscar modelo, marca ou código Kaido..." style="width: 100%; padding: 12px; background: #0f172a; border: 1px solid #475569; color: white; border-radius: 6px; font-family: 'Barlow', sans-serif; font-size: 16px; outline: none; box-sizing: border-box;">
      </div>

      <div class="count-bar" style="display: flex; margin-bottom: 15px; color: #cbd5e1; font-size: 14px; background: #1e293b; padding: 10px; border-radius: 6px; border: 1px solid #334155;">
          <span>Exibindo <b id="kaido-visible-count" style="color: #fff;">0</b> de <b id="kaido-all-count" style="color: #fff;">0</b> carros</span>
      </div>
      
      <div class="car-grid" id="kaido-grid"></div>

      <div class="pagination-container" style="display: flex; justify-content: space-between; align-items: center; padding: 20px 0; font-family: 'Barlow', sans-serif; flex-wrap: wrap; gap: 15px; margin-top: 20px; border-top: 1px solid #334155;">
          <div class="items-per-page">
              <label style="font-size: 14px; color: #cbd5e1; margin-right: 8px;">Mostrar: </label>
              <select id="kaido-per-page-select" style="padding: 6px 12px; border-radius: 4px; border: 1px solid #475569; background: #0f172a; color: white; outline: none; cursor: pointer;">
                  <option value="25" selected>25</option>
                  <option value="50" >50</option>
                  <option value="100">100</option>
                  <option value="all">Todos</option>
              </select>
          </div>

          <div class="pagination-controls" style="display: flex; gap: 10px; align-items: center;">
              <button id="kaido-btn-prev" class="btn-clear" style="padding: 8px 16px; border: 1px solid #475569; border-radius: 4px; background: #1e293b; color: white; cursor: pointer; font-weight: 500;">← Anterior</button>
              <span id="kaido-page-indicator" style="font-size: 14px; font-weight: bold; color: white; min-width: 100px; text-align: center;">Página 1 de 1</span>
              <button id="kaido-btn-next" class="btn-clear" style="padding: 8px 16px; border: 1px solid #475569; border-radius: 4px; background: #1e293b; color: white; cursor: pointer; font-weight: 500;">Próximo →</button>
          </div>
      </div>
    `;

    document.getElementById('kaido-filter-owned').addEventListener('click', (e) => {
      showingOnlyOwnedKaido = !showingOnlyOwnedKaido;
      e.target.style.background = showingOnlyOwnedKaido ? '#c084fc' : '#1e293b';
      e.target.style.color = showingOnlyOwnedKaido ? '#000' : '#cbd5e1';
      window.kaidoCurrentPage = 1;
      window.renderKaidoGrid();
    });

    document.getElementById('kaido-filter-wishlist').addEventListener('click', (e) => {
      showingOnlyWishlistKaido = !showingOnlyWishlistKaido;
      e.target.style.background = showingOnlyWishlistKaido ? '#ef4444' : '#1e293b';
      e.target.style.color = showingOnlyWishlistKaido ? '#fff' : '#cbd5e1';
      window.kaidoCurrentPage = 1;
      window.renderKaidoGrid();
    });

    // EVENTOS DA BARRA DE PESQUISA
    document.getElementById('kaido-search').addEventListener('input', () => {
      window.kaidoCurrentPage = 1;
      window.renderKaidoGrid();
    });

    // EVENTOS DA PAGINAÇÃO
    document.getElementById('kaido-per-page-select').addEventListener('change', (e) => {
      window.kaidoItemsPerPage = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
      window.kaidoCurrentPage = 1;
      window.renderKaidoGrid();
    });

    document.getElementById('kaido-btn-prev').addEventListener('click', () => {
      if (window.kaidoCurrentPage > 1) {
        window.kaidoCurrentPage--;
        window.renderKaidoGrid();
      }
    });

    document.getElementById('kaido-btn-next').addEventListener('click', () => {
      const searchInput = document.getElementById('kaido-search');
      const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

      const filteredData = KAIDO_DATA.filter(car => {
        const matchesSearch = !query ||
          (car.modelo && car.modelo.toLowerCase().includes(query)) ||
          (car.codigo && car.codigo.toLowerCase().includes(query)) ||
          (car.marca && car.marca.toLowerCase().includes(query));

        const matchesOwned = !showingOnlyOwnedKaido || (userKaidoCollection[car.codigo] > 0);
        const matchesWish = !showingOnlyWishlistKaido || userWishlist[car.codigo];

        return matchesSearch && matchesOwned && matchesWish;
      });

      const maxPages = window.kaidoItemsPerPage === 'all' ? 1 : Math.ceil(filteredData.length / window.kaidoItemsPerPage);
      if (window.kaidoCurrentPage < maxPages) {
        window.kaidoCurrentPage++;
        window.renderKaidoGrid();
      }
    });
  }

  window.renderKaidoGrid();
};


window.renderKaidoGrid = function () {
  const grid = document.getElementById('kaido-grid');
  const searchInput = document.getElementById('kaido-search');
  if (!grid || !searchInput) return;

  const query = searchInput.value.toLowerCase().trim();
  grid.innerHTML = ''; // Limpa a tela para os novos resultados

  // 1. TRAVAS DE SEGURANÇA PARA AS VARIÁVEIS
  const ownedKaidos = (typeof userKaidoCollection !== 'undefined' && userKaidoCollection) ? userKaidoCollection : {};
  const wishKaidos = (typeof userWishlist !== 'undefined' && userWishlist) ? userWishlist : {};
  const isOwnedActive = (typeof showingOnlyOwnedKaido !== 'undefined') ? showingOnlyOwnedKaido : false;
  const isWishActive = (typeof showingOnlyWishlistKaido !== 'undefined') ? showingOnlyWishlistKaido : false;

  // 2. APLICA TODOS OS FILTROS AO MESMO TEMPO
  const filteredData = KAIDO_DATA.filter(car => {
    // Pesquisa por texto
    const matchesSearch = !query ||
      (car.modelo && car.modelo.toLowerCase().includes(query)) ||
      (car.codigo && car.codigo.toLowerCase().includes(query)) ||
      (car.marca && car.marca.toLowerCase().includes(query));

    // Filtro "Minha Coleção" (mostra apenas se a quantidade for maior que zero)
    const matchesOwned = !isOwnedActive || (ownedKaidos[car.codigo] > 0);

    // Filtro "Lista de Desejos" (mostra apenas se tiver coração)
    const matchesWish = !isWishActive || wishKaidos[car.codigo];

    return matchesSearch && matchesOwned && matchesWish;
  });

  // 3. APLICA A PAGINAÇÃO
  let dataToRender = filteredData;
  let totalPages = 1;
  let itemsPerPage = (typeof window.kaidoItemsPerPage !== 'undefined') ? window.kaidoItemsPerPage : 25;

  if (itemsPerPage !== 'all') {
    totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
    if (typeof window.kaidoCurrentPage === 'undefined') window.kaidoCurrentPage = 1;
    if (window.kaidoCurrentPage > totalPages) window.kaidoCurrentPage = totalPages;
    if (window.kaidoCurrentPage < 1) window.kaidoCurrentPage = 1;

    const start = (window.kaidoCurrentPage - 1) * itemsPerPage;
    dataToRender = filteredData.slice(start, start + itemsPerPage);
  }

  // 4. ATUALIZA TEXTOS E INDICADORES DA TELA
  const pageIndicator = document.getElementById('kaido-page-indicator');
  const btnPrev = document.getElementById('kaido-btn-prev');
  const btnNext = document.getElementById('kaido-btn-next');
  const visCount = document.getElementById('kaido-visible-count');
  const allCount = document.getElementById('kaido-all-count');
  const badge = document.getElementById('kaido-count-badge');

  if (pageIndicator) pageIndicator.textContent = `Página ${window.kaidoCurrentPage || 1} de ${totalPages}`;
  if (btnPrev) { btnPrev.disabled = (window.kaidoCurrentPage === 1); btnPrev.style.opacity = btnPrev.disabled ? "0.3" : "1"; }
  if (btnNext) { btnNext.disabled = (window.kaidoCurrentPage === totalPages); btnNext.style.opacity = btnNext.disabled ? "0.3" : "1"; }
  if (visCount) visCount.textContent = dataToRender.length;
  if (allCount) allCount.textContent = filteredData.length;
  if (badge) badge.textContent = `${filteredData.length} Modelos`;

  // 5. DESENHA AS MINIATURAS NA TELA
  dataToRender.forEach(car => {
    const qty = ownedKaidos[car.codigo] || 0;
    const repetidos = qty > 1 ? qty - 1 : 0;
    const has = qty > 0;

    const card = document.createElement('div');
    card.className = `car-card ${has ? 'owned-card' : ''}`;

    let optionsHTML = '';
    for (let i = 0; i <= 50; i++) {
      optionsHTML += `<option value="${i}" ${i === qty ? 'selected' : ''}>${i}</option>`;
    }

    let controlesHTML = `
      <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
        <select class="qty-input" style="width: 100%; max-width: 65px; padding: 8px; background: #0f172a; border: 1px solid #475569; color: var(--yellow); border-radius: 6px; font-weight: bold; font-size: 16px; outline: none; cursor: pointer; appearance: none; -webkit-appearance: none; text-align-last: center;">
          ${optionsHTML}
        </select>
        <button class="btn-save-kaido" style="display: none; flex: 1; padding: 8px; background: #16a34a; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Salvar</button>
        ${repetidos > 0 ? `<span class="rep-badge" style="background: #ffedd5; color: #ea580c; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 11px;">+${repetidos}</span>` : ''}
      </div>`;

    card.innerHTML = `
      <div class="car-image-container" style="position: relative;">
        <span class="year-badge" style="background: #c084fc; color: #fff; font-family: 'Barlow', sans-serif;">${car.codigo}</span>
        <img src="${car.caminho_imagem}" loading="lazy" alt="${car.modelo}" onerror="this.src='assets/img/placeholder.png';">
      </div>
      <div class="car-info">
        <div style="display: flex; justify-content: space-between; align-items: start;">
            <div class="car-title" title="${car.modelo}">${car.modelo}</div>
            <button id="wish-${car.codigo}" onclick="toggleWishlist('${car.codigo}')" style="background: none; border: none; font-size: 18px; cursor: pointer; padding: 0 0 0 8px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); transition: transform 0.2s;">
                ${wishKaidos[car.codigo] ? '❤️' : '🤍'}
            </button>
        </div>
        <div class="car-series">${car.fabricante || ''} | Escala ${car.escala || '1:64'}</div>
        <div style="display:flex; align-items:center; gap:6px; margin-top: 12px; margin-bottom: 12px; font-size: 11px; color: #cbd5e1; font-weight: bold; text-transform: uppercase;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#c084fc; box-shadow:0 0 0 1px rgba(255,255,255,0.15)"></span>
            ${car.marca || ''}
        </div>
        <div class="car-controls">
            ${controlesHTML}
        </div>
      </div>
    `;

    grid.appendChild(card);

    const inputElement = card.querySelector('.qty-input');
    const saveBtn = card.querySelector('.btn-save-kaido');

    inputElement.addEventListener('change', (e) => {
      let newVal = parseInt(e.target.value) || 0;
      saveBtn.style.display = newVal !== qty ? 'block' : 'none';
    });

    saveBtn.addEventListener('click', () => {
      if (window.saveKaidoData) window.saveKaidoData(car.codigo, parseInt(inputElement.value) || 0);
      saveBtn.style.display = 'none';
      setTimeout(() => window.renderKaidoGrid(), 50);
    });
  });

  if (filteredData.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--muted); font-size: 16px;">Nenhum modelo encontrado com os filtros selecionados.</div>`;
  }
};

window.updateSidebarVisibility = function (tipo) {
  const hwItems = document.querySelectorAll('.hw-menu-item, .sth-menu-item');
  const kaidoItems = document.querySelectorAll('.kaido-menu-item');

  if (tipo === 'kaido') {
    hwItems.forEach(el => el.style.display = 'none');
    kaidoItems.forEach(el => el.style.display = 'block');
  } else {
    hwItems.forEach(el => el.style.display = 'block');
    kaidoItems.forEach(el => el.style.display = 'none');
  }
};

window.toggleWishlist = async function (carId) {
  if (isPublicView) return;


  userWishlist[carId] = !userWishlist[carId];


  const btn = document.getElementById(`wish-${carId}`);
  if (btn) btn.innerHTML = userWishlist[carId] ? '❤️' : '🤍';


  if (!userWishlist[carId]) {
    if (typeof pageType !== 'undefined' && pageType === 'wishlist') {
      setTimeout(() => {
        updatePageData();
        render();
      }, 50);
    } else if (typeof pageType !== 'undefined' && pageType === 'kaido-wishlist') {
      // Recarrega o grid da Kaido instantaneamente
      setTimeout(() => window.renderKaidoGrid(), 50);
    }
  }

  const uidToSave = targetUid || sessionUid;
  if (!uidToSave) return;

  try {
    await setDoc(doc(db, 'collections', uidToSave), { wishlist: userWishlist }, { merge: true });
  } catch (e) {
    console.error("Erro ao salvar wishlist:", e);
  }
};

window.copiarLinkPublico = function () {
  const link = `${window.location.origin}${window.location.pathname}?garagem=${sessionUid}`;
  navigator.clipboard.writeText(link).then(() => {
    alert("🔗 Link da sua garagem copiado!\nEnvie para seus amigos verem sua coleção.");
  });
};

window.renderStats = function () {
  const container = document.getElementById('stats-view');
  if (!container) return;

  let totalHW = 0, totalKaido = 0, totalWishlist = 0;

  Object.values(userCollection).forEach(qty => { if (qty > 0) totalHW += qty; });
  Object.values(userKaidoCollection).forEach(qty => { if (qty > 0) totalKaido += qty; });
  Object.values(userWishlist).forEach(wished => { if (wished) totalWishlist++; });

  const pctHW = Math.round((Object.keys(userCollection).filter(k => userCollection[k] > 0).length / PAGE_DATA.length) * 100) || 0;

  container.innerHTML = `
    <div style="margin-bottom: 30px;">
        <h2 style="font-family: 'Bebas Neue', sans-serif; color: #fff; font-size: 32px; margin: 0; letter-spacing: 1px;">Visão Geral da Garagem</h2>
        <p style="color: var(--muted); font-size: 14px;">Acompanhe o crescimento do seu império diecast.</p>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px;">
        <div style="background: var(--surface); padding: 20px; border-radius: 12px; border: 1px solid var(--border); text-align: center;">
            <div style="font-size: 36px; margin-bottom: 10px;">🔥</div>
            <div style="font-size: 28px; font-weight: bold; color: #fff; font-family: 'Bebas Neue';">${totalHW}</div>
            <div style="color: var(--muted); font-size: 13px; text-transform: uppercase;">Hot Wheels na Garagem</div>
        </div>
        <div style="background: var(--surface); padding: 20px; border-radius: 12px; border: 1px solid var(--border); text-align: center;">
            <div style="font-size: 36px; margin-bottom: 10px;">🔰</div>
            <div style="font-size: 28px; font-weight: bold; color: #c084fc; font-family: 'Bebas Neue';">${totalKaido}</div>
            <div style="color: var(--muted); font-size: 13px; text-transform: uppercase;">Kaido House</div>
        </div>
        <div style="background: var(--surface); padding: 20px; border-radius: 12px; border: 1px solid var(--border); text-align: center;">
            <div style="font-size: 36px; margin-bottom: 10px;">❤️</div>
            <div style="font-size: 28px; font-weight: bold; color: #ef4444; font-family: 'Bebas Neue';">${totalWishlist}</div>
            <div style="color: var(--muted); font-size: 13px; text-transform: uppercase;">Na Lista de Desejos</div>
        </div>
    </div>

    <div style="background: var(--surface); padding: 24px; border-radius: 12px; border: 1px solid var(--border);">
        <h3 style="color: #fff; margin-top: 0; margin-bottom: 15px; font-family: 'Bebas Neue'; font-size: 24px;">Progresso da Coleção (HW)</h3>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #cbd5e1; font-weight: bold;">
            <span>Completude do Catálogo</span>
            <span style="color: var(--yellow);">${pctHW}%</span>
        </div>
        <div style="width: 100%; background: #0f172a; border-radius: 10px; height: 12px; overflow: hidden; border: 1px solid #334155;">
            <div style="width: ${pctHW}%; background: linear-gradient(90deg, #facc15, #f59e0b); height: 100%; border-radius: 10px;"></div>
        </div>
    </div>
  `;
};
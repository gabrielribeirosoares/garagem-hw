import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { RAW } from './data.js';
import { KAIDO_DATA } from './data_kaido.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('PWA Ativo na Garagem!', reg.scope))
      .catch(err => console.log('Falha no PWA:', err));
  });
}

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
let publicOwnerName = "Colecionador";
let userKaidoCollection = {};
let userPrices = {};
let userKaidoPrices = {};
let sortCol = 'year';
let sortDesc = true;
let userPoints = 0;
let userMissions = {};
let userRewards = [];

let currentPage = 1;
let itemsPerPage = 25;
let lbIndex = 0;

let userAccountType = 'standalone';
let isAdmin = false;
let targetUid = null;
let targetRole = 'user';
let isManager = false;
let userHistory = [];

let userWishlist = {};

window.lojaIdAtual = 'default';
window.LISTA_RIFAS = [];

const urlParams = new URLSearchParams(window.location.search);
const publicGarageUid = urlParams.get('garagem');
const isPublicView = !!publicGarageUid;

if (urlParams.has('type')) {
  pageType = urlParams.get('type');


  const cleanUrl = window.location.pathname + (isPublicView ? `?garagem=${publicGarageUid}` : '');
  window.history.replaceState({}, '', cleanUrl);
}


function updatePageData() {
  PAGE_DATA = RAW.filter(r => {
    if (pageType === 'all' || pageType === 'owned') return true;
    if (pageType === 'sth' && r.series && r.series.toLowerCase().includes('super')) return true;
    if (pageType === 'th' && r.series && !r.series.toLowerCase().includes('super')) return true;

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
    titleEl.innerHTML = isPublicView ? `Garagem de <span>${publicOwnerName}</span>` : 'Minha <span>Coleção</span>';
    badgeEl.style.display = 'none';
  } else if (pageType === 'wishlist') {
    titleEl.innerHTML = 'Lista de <span>Desejos</span>';
    badgeEl.style.display = 'block';
    badgeEl.textContent = '❤️';
  }

  document.getElementById('filter-search').value = '';
  currentPage = 1;
}

window.changePage = function (newPageType) {

  if (isPublicView) {
    if (newPageType === 'all') newPageType = 'owned';
    if (newPageType === 'kaido') newPageType = 'kaido-owned';
  }

  pageType = newPageType;

  if (!isPublicView) {
    const urlAtual = new URL(window.location.href);
    urlAtual.searchParams.set('type', newPageType);
    window.history.replaceState({}, '', urlAtual.toString());
  }

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
  const sorteiosArea = document.getElementById('sorteios-view');
  const encomendasArea = document.getElementById('encomendas-view');

  if (pageType === 'kaido' || pageType === 'kaido-owned' || pageType === 'kaido-wishlist') {
    updateSidebarVisibility('kaido');
  } else {
    updateSidebarVisibility('hw');
  }





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
    if (sorteiosArea) sorteiosArea.style.display = 'none';
    if (encomendasArea) encomendasArea.style.display = 'none';

    if (missionsArea) missionsArea.style.display = 'block';
    document.getElementById('dynamic-title').innerHTML = 'Garagem <span>VIP</span>';
    document.getElementById('dynamic-badge').style.display = 'none';
    if (window.renderMissions) window.renderMissions();
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
    if (sorteiosArea) sorteiosArea.style.display = 'none';
    if (encomendasArea) encomendasArea.style.display = 'none';

    if (rewardsArea) rewardsArea.style.display = 'block';
    document.getElementById('dynamic-title').innerHTML = 'Loja de <span>RPMs</span>';
    document.getElementById('dynamic-badge').style.display = 'none';
    if (window.renderRewards) window.renderRewards();
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
    if (sorteiosArea) sorteiosArea.style.display = 'none';
    if (encomendasArea) encomendasArea.style.display = 'none';

    if (kaidoArea) kaidoArea.style.display = 'block';
    if (pageType === 'kaido-owned') {
      document.getElementById('dynamic-title').innerHTML = isPublicView ? `Kaidos de <span>${publicOwnerName}</span>` : 'Minha Coleção <span>Kaido</span>';
    } else if (pageType === 'kaido-wishlist') {
      document.getElementById('dynamic-title').innerHTML = isPublicView ? `Desejos de <span>${publicOwnerName}</span>` : 'Desejos <span>Kaido</span>';
    } else {
      document.getElementById('dynamic-title').innerHTML = 'Kaido <span>House</span>';
    }
    document.getElementById('dynamic-badge').style.display = 'none';
    if (window.renderKaido) window.renderKaido(pageType);
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
    if (sorteiosArea) sorteiosArea.style.display = 'none';
    if (encomendasArea) encomendasArea.style.display = 'none';

    if (statsArea) statsArea.style.display = 'block';
    document.getElementById('dynamic-title').innerHTML = 'Meu <span>Dashboard</span>';
    document.getElementById('dynamic-badge').style.display = 'none';
    if (window.renderStats) window.renderStats();
    return;

  } else if (pageType === 'sorteios') {
    if (tableArea) tableArea.style.display = 'none';
    if (sortHeader) sortHeader.style.display = 'none';
    if (controlsArea) controlsArea.style.display = 'none';
    if (countArea) countArea.style.display = 'none';
    if (pagArea) pagArea.style.display = 'none';
    if (missionsArea) missionsArea.style.display = 'none';
    if (rewardsArea) rewardsArea.style.display = 'none';
    if (kaidoArea) kaidoArea.style.display = 'none';
    if (statsRow) statsRow.style.display = 'none';
    if (statsArea) statsArea.style.display = 'none';
    if (encomendasArea) encomendasArea.style.display = 'none';

    if (sorteiosArea) sorteiosArea.style.display = 'block';
    document.getElementById('dynamic-title').innerHTML = 'Rifas & <span>Sorteios</span>';
    document.getElementById('dynamic-badge').style.display = 'none';
    if (window.renderSorteios) window.renderSorteios();
    return;

  } else if (pageType === 'encomendas') {
    if (tableArea) tableArea.style.display = 'none';
    if (sortHeader) sortHeader.style.display = 'none';
    if (controlsArea) controlsArea.style.display = 'none';
    if (countArea) countArea.style.display = 'none';
    if (pagArea) pagArea.style.display = 'none';
    if (missionsArea) missionsArea.style.display = 'none';
    if (rewardsArea) rewardsArea.style.display = 'none';
    if (kaidoArea) kaidoArea.style.display = 'none';
    if (statsRow) statsRow.style.display = 'none';
    if (statsArea) statsArea.style.display = 'none';
    if (sorteiosArea) sorteiosArea.style.display = 'none';

    if (encomendasArea) encomendasArea.style.display = 'block';
    document.getElementById('dynamic-title').innerHTML = 'Minhas <span>Encomendas</span>';
    document.getElementById('dynamic-badge').style.display = 'none';
    if (window.renderEncomendas) window.renderEncomendas();
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
    if (sorteiosArea) sorteiosArea.style.display = 'none';
    if (encomendasArea) encomendasArea.style.display = 'none';

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

  const cases = [...new Set(PAGE_DATA.map(r => r.cas))].filter(Boolean).sort();
  const selCase = document.getElementById('filter-cas');
  if (selCase) {
    selCase.innerHTML = '<option value="">Todos</option>';
    cases.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = `Lote ${c}`;
      selCase.appendChild(opt);
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
  const caseInput = document.getElementById('filter-cas');
  const filterOwnedCheckbox = document.getElementById('filter-owned-only');

  // Adicionada proteção (Ternário) para evitar quebra quando os filtros somem da tela
  const sq = searchInput ? searchInput.value.toLowerCase() : '';
  const sy = yearInput ? yearInput.value : '';
  const se = eraInput ? eraInput.value : '';
  const ss = seriesInput ? seriesInput.value : '';
  const sc = caseInput ? caseInput.value : '';

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
    if (sc) match = match && r.cas === sc; 
    if (so) match = match && isOwned(r);
    return match;
  });

  filtered.sort((a, b) => {
    let vA = a[sortCol];
    let vB = b[sortCol];

    if (sortCol === 'name' || sortCol === 'series' || sortCol === 'color' || sortCol === 'part' || sortCol === 'cas') {
      vA = String(vA || '').trim().toLowerCase();
      vB = String(vB || '').trim().toLowerCase();
    }

    if (sortCol === 'cas') {
      if (vA === '' && vB !== '') return 1;
      if (vA !== '' && vB === '') return -1;

      if (vA === vB) {
        let nA = String(a.name || '').trim().toLowerCase();
        let nB = String(b.name || '').trim().toLowerCase();
        if (nA < nB) return -1;
        if (nA > nB) return 1;
        return 0;
      }
    }

    if (vA < vB) return sortDesc ? 1 : -1;
    if (vA > vB) return sortDesc ? -1 : 1;
    return 0;
  });

  // --- APLICAÇÃO DOS NOVOS FILTROS (Scanner e Trocas) ---
  if (window.searchTerms) {
    filtered = filtered.filter(r =>
      (r.name && r.name.toLowerCase().includes(window.searchTerms)) ||
      (r.part && r.part.toLowerCase().includes(window.searchTerms)) ||
      (r.year && r.year.toString().includes(window.searchTerms))
    );
  }

  if (window.showOnlyTrades) {
    filtered = filtered.filter(r => getQty(r) > 1);
  }

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

    const isSth = r.series && r.series.toLowerCase().includes('super');
    const card = document.createElement('div');
    card.className = `car-card ${has ? 'owned-card' : ''} ${isSth ? 'holographic' : ''}`;

    const imgCell = r.image
      ? `<img src="${r.image}" loading="lazy">`
      : `<div style="font-size:40px; color: var(--muted);">🚗</div>`;

    const qty = getQty(r);
    const repetidos = qty > 1 ? qty - 1 : 0;
    const isEditingAllowed = !isPublicView;

    const isVendedorEditandoCliente = (isAdmin || isManager) && targetUid && targetUid !== 'ME' && targetUid !== sessionUid;

    let controlesHTML = '';

    if (isEditingAllowed) {
      controlesHTML = `
        <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
          <button class="btn-minus" style="padding: 8px 15px; background: #334155; color: white; border: 1px solid #475569; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 18px;" ${qty === 0 ? 'disabled style="opacity: 0.5;"' : ''}>-</button>
          <div style="flex: 1; text-align: center; background: #0f172a; border: 1px solid #475569; color: var(--yellow); border-radius: 6px; padding: 8px; font-weight: bold; font-size: 16px;">${qty}</div>
          <button class="btn-plus" style="padding: 8px 15px; background: #16a34a; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 18px;">+</button>
          ${repetidos > 0 ? `<span class="rep-badge" style="background: #ffedd5; color: #ea580c; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 11px;">+${repetidos}</span>` : ''}
        </div>`;
    } else {
      controlesHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <span style="font-size: 20px; font-family: 'Bebas Neue'; color: ${qty > 0 ? 'var(--yellow)' : 'var(--muted)'};">${qty} na Garagem</span>
          ${repetidos > 0 ? `<span class="rep-badge" style="background: #ffedd5; color: #ea580c; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 11px;">+${repetidos}</span>` : ''}
        </div>`;
    }

    let btnVenderHTML = '';
    if (isVendedorEditandoCliente) {
      btnVenderHTML = `<button onclick="window.venderCarroVisual('${r.id}', event)" style="margin-top: 10px; width: 100%; background: #38bdf8; color: #000; border: none; padding: 8px; border-radius: 6px; font-weight: bold; font-family: 'Bebas Neue', sans-serif; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; box-shadow: 0 4px 6px rgba(56,189,248,0.2);">📦 Encomendar para Garagem</button>`;
    }

    const loteBadge = r.cas
      ? `<span style="position: absolute; top: 8px; right: 8px; background: #334155; color: #f8fafc; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; border: 1px solid #475569; z-index: 2; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">LOTE ${r.cas}</span>`
      : '';

    card.innerHTML = `
      <div class="car-image-container" style="position: relative; cursor: pointer;">
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
            ${btnVenderHTML}
        </div>
      </div>
    `;

    if (card.querySelector('.car-image-container') && r.image) {
      card.querySelector('.car-image-container').addEventListener('click', () => {
        window.currentFilteredData = fullData;
        openLb(fullData.indexOf(r));
      });
    }

    tbody.appendChild(card);

    if (isEditingAllowed) {
      const btnMinus = card.querySelector('.btn-minus');
      const btnPlus = card.querySelector('.btn-plus');

      if (btnMinus) {
        btnMinus.addEventListener('click', () => {
          if (qty > 0) {
            saveData(r.id, qty - 1);
            updateCounts();
            setTimeout(() => render(), 50);
          }
        });
      }

      if (btnPlus) {
        btnPlus.addEventListener('click', () => {
          saveData(r.id, qty + 1);
          updateCounts();
          setTimeout(() => render(), 50);
        });
      }
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

  let totalGlobal = 0;
  Object.values(userCollection).forEach(q => { if (q > 0) totalGlobal += q; });
  Object.values(userKaidoCollection).forEach(q => { if (q > 0) totalGlobal += q; });

  let nivelText = 'Piloto Novato 🥉';
  let nivelColor = '#cd7f32';
  let rgbColor = '205, 127, 50';

  if (totalGlobal >= 300) {
    nivelText = 'Magnata Diecast 💎';
    nivelColor = '#06b6d4';
    rgbColor = '6, 182, 212';
  } else if (totalGlobal >= 150) {
    nivelText = 'Garagem de Elite 🥇';
    nivelColor = '#fbbf24';
    rgbColor = '251, 191, 36';
  } else if (totalGlobal >= 50) {
    nivelText = 'Colecionador Pro 🥈';
    nivelColor = '#94a3b8';
    rgbColor = '148, 163, 184';
  }

  let badgeEl = document.getElementById('user-level-badge');
  if (!badgeEl) {
    badgeEl = document.createElement('div');
    badgeEl.id = 'user-level-badge';
    badgeEl.style.cssText = 'display: none; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 8px; font-family: "Bebas Neue", sans-serif; font-size: 18px; white-space: nowrap; margin-right: 10px;';

    const pointsContainer = document.getElementById('points-container');
    if (pointsContainer && pointsContainer.parentNode) {
      pointsContainer.parentNode.insertBefore(badgeEl, pointsContainer);
    }
  }

  badgeEl.style.background = `rgba(${rgbColor}, 0.1)`;
  badgeEl.style.border = `1px solid rgba(${rgbColor}, 0.3)`;
  badgeEl.style.color = nivelColor;
  badgeEl.textContent = nivelText;

  if (sessionUid && !isPublicView) {
    badgeEl.style.display = 'flex';
  }
}

window.renderSkeleton = function (containerId, count = 12) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-card">
        <div class="skeleton-img"></div>
        <div class="skeleton-info">
          <div class="skeleton-line title"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
          <div class="skeleton-line button"></div>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    sessionUid = user.uid;
    renderSkeleton('table-body');

    const pendingInvite = localStorage.getItem('pendingInvite');
    if (pendingInvite) {
      try {
        const uRef = doc(db, 'users', user.uid);
        const uSnap = await getDoc(uRef);
        if (uSnap.exists()) {
          let currentLojas = uSnap.data().lojaId || '';
          let lojasArray = currentLojas.split(',').map(s => s.trim()).filter(Boolean);


          if (!lojasArray.includes(pendingInvite)) {
            lojasArray.push(pendingInvite);
            await setDoc(uRef, { lojaId: lojasArray.join(', ') }, { merge: true });
            alert(`🎉 Sucesso! Você agora é um membro VIP da loja: ${pendingInvite}`);
          }
        }
      } catch (e) {
        console.error("Erro ao processar convite:", e);
      }

      localStorage.removeItem('pendingInvite');
    }

    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = user.email;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const menuAdminItem = document.getElementById('menu-admin-item');

      if (userDoc.exists()) {
        const userRole = userDoc.data().role;


        const myLojaIdRaw = userDoc.data().lojaId || '';
        const myLojaId = myLojaIdRaw.split(',')[0].trim();
        const minhaLojaFiltro = myLojaId.toLowerCase();

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


          clientSelect.innerHTML = '<option value="ME">Minha Conta</option>';

          const usersSnap = await getDocs(collection(db, 'users'));
          usersSnap.forEach(docSnap => {
            const uData = docSnap.data();


            const clientLojas = (uData.lojaId || '').split(',').map(s => s.trim().toLowerCase());


            const isMyClient = clientLojas.includes(minhaLojaFiltro);

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

    if (isPublicView) {
      renderSkeleton('table-body');
      console.log("Visitante acessando garagem pública.");
      if (typeof window.loadCollection === 'function') window.loadCollection();
    } else {
      window.location.href = 'index.html';
    }
  }

  const isVip = (targetRole === 'cliente' || targetRole === 'admin' || isManager);
  const pointsContainer = document.getElementById('points-container');

  if (pointsContainer) {
    pointsContainer.style.display = isVip ? 'flex' : 'none';
  }

  document.querySelectorAll('[data-page="missions"], [data-page="rewards"], [data-page="sorteios"]').forEach(el => {
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

window.loadCollection = async function () {
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
      userPrices = snap.data().prices || {};
      userKaidoPrices = snap.data().kaidoPrices || {};
    } else {
      userCollection = {};
      userKaidoCollection = {};
      userPoints = 0;
      userMissions = {};
      userRewards = [];
      userHistory = [];
      userWishlist = {};
      userPrices = {};
      userKaidoPrices = {};
    }


    const uRef = doc(db, 'users', uidToLoad);
    const uSnap = await getDoc(uRef);

    let currentLojaId = 'default';

    if (uSnap.exists()) {
      targetRole = uSnap.data().role || 'user';
      currentLojaId = uSnap.data().lojaId || 'default';
      window.lojaIdAtual = currentLojaId;

      if (targetRole === 'admin' || targetRole === 'gerente') {
        const btnSorteador = document.getElementById('menu-sorteador-item');
        if (btnSorteador) btnSorteador.style.display = 'block';
      }

      if (typeof isPublicView !== 'undefined' && isPublicView) {
        const nomeEncontrado = uSnap.data().name || uSnap.data().nome;
        if (nomeEncontrado) {
          publicOwnerName = nomeEncontrado.split(' ')[0];
        }

        const menusToHide = ['rewards', 'missions', 'stats', 'sorteios'];
        menusToHide.forEach(page => {
          const link = document.querySelector(`[data-page="${page}"]`);
          if (link && link.parentElement) link.parentElement.style.display = 'none';
        });

        const menuProfile = document.getElementById('menu-profile');
        if (menuProfile) menuProfile.parentElement.style.display = 'none';

        const menuLogout = document.getElementById('logout-menu');
        if (menuLogout) menuLogout.parentElement.style.display = 'none';

        const adminSelector = document.getElementById('admin-client-selector');
        if (adminSelector) adminSelector.style.display = 'none';
      }
    } else {
      targetRole = 'user';
    }

    if (!isPublicView) {
      try {
        const lojasArray = currentLojaId.split(',').map(s => s.trim()).filter(Boolean);
        window.minhasLojasArray = lojasArray;
        LISTA_RECOMPENSAS = [];
        window.LISTA_RIFAS = [];

        window.userPointsMap = snap.data().pointsMap || {};
        if (typeof snap.data().points === 'number' && Object.keys(window.userPointsMap).length === 0) {
          window.userPointsMap[lojasArray[0] || 'default'] = snap.data().points;
        }

        if (!window.lojaAtiva || !lojasArray.includes(window.lojaAtiva)) {
          window.lojaAtiva = lojasArray[0] || "";
        }


        for (const lId of lojasArray) {
          const lojaRef = doc(db, 'lojas', lId);
          const lojaSnap = await getDoc(lojaRef);
          if (lojaSnap.exists()) {
            const wpp = lojaSnap.data().whatsapp || "5548999999999";
            const rews = lojaSnap.data().recompensas || [];
            const rifs = lojaSnap.data().rifas || [];

            rews.forEach(r => LISTA_RECOMPENSAS.push({ ...r, wppOrigem: wpp, lojaOrigem: lId }));
            rifs.forEach(r => window.LISTA_RIFAS.push({ ...r, wppOrigem: wpp, lojaOrigem: lId }));
          }
        }
      } catch (e) {
        console.error("Erro ao carregar dados das lojas:", e);
        LISTA_RECOMPENSAS = [];
        window.LISTA_RIFAS = [];
      }
    } else {
      LISTA_RECOMPENSAS = [];
      window.LISTA_RIFAS = [];
    }

    const pointsEl = document.getElementById('user-points');
    if (pointsEl) pointsEl.textContent = userPoints;

    if (isPublicView) {
      changePage('owned');
    } else {
      changePage(pageType || 'all');
    }

  } catch (err) {
    console.error("Erro load:", err);
    changePage(isPublicView ? 'owned' : (pageType || 'all'));
  }
}

let saveTimeout = null;
let saveKaidoTimeout = null;

const PONTOS_POR_CARRO = 100;

async function saveData(carId, qty) {
  const oldQty = userCollection[carId] || 0;
  const uidToSave = targetUid || sessionUid;
  const isVendedorEditandoCliente = (isAdmin || isManager) && targetUid && targetUid !== sessionUid;

  if (qty > oldQty) {
    const addedQty = qty - oldQty;
    const priceInput = prompt(`Adicionando ${addedQty} unidade(s).\nQual foi o valor pago POR UNIDADE? (Ex: 25.50)`, "25.00");

    if (priceInput !== null) {
      const newPrice = parseFloat(priceInput.replace(',', '.')) || 0;
      const currentAvg = userPrices[carId] || 0;
      const currentTotal = oldQty * currentAvg;
      const addedTotal = addedQty * newPrice;

      userPrices[carId] = (currentTotal + addedTotal) / qty;
    }
  }

  userCollection[carId] = qty;

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
      await setDoc(dRef, {
        items: userCollection,
        points: userPoints,
        wishlist: userWishlist,
        prices: userPrices
      }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  }, 1000);
}

window.saveKaidoData = async function (codigo, qty) {
  const oldQty = userKaidoCollection[codigo] || 0;
  const uidToSave = targetUid || sessionUid;
  const isVendedorEditandoCliente = (isAdmin || isManager) && targetUid && targetUid !== sessionUid;

  if (qty > oldQty) {
    const addedQty = qty - oldQty;
    const priceInput = prompt(`Adicionando ${addedQty} unidade(s) Kaido.\nQual foi o valor pago POR UNIDADE? (Ex: 180.00)`, "180.00");

    if (priceInput !== null) {
      const newPrice = parseFloat(priceInput.replace(',', '.')) || 0;
      const currentAvg = userKaidoPrices[codigo] || 0;
      const currentTotal = oldQty * currentAvg;
      const addedTotal = addedQty * newPrice;

      userKaidoPrices[codigo] = (currentTotal + addedTotal) / qty;
    }
  }

  userKaidoCollection[codigo] = qty;

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
      await setDoc(dRef, {
        kaidoItems: userKaidoCollection,
        points: userPoints,
        wishlist: userWishlist,
        kaidoPrices: userKaidoPrices
      }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  }, 1000);
};

function openLb(index) {
  lbIndex = index;
  const listaAtual = window.currentFilteredData || PAGE_DATA;
  const r = listaAtual[lbIndex];

  if (!r) return;

  const qty = (typeof userCollection !== 'undefined' ? userCollection[r.id] : 0) || 0;
  const kaidoQty = (typeof userKaidoCollection !== 'undefined' ? userKaidoCollection[r.codigo] : 0) || 0;
  const hasItem = qty > 0 || kaidoQty > 0;

  const badgeColor = hasItem ? '#16a34a' : '#ef4444';
  const badgeText = hasItem ? 'Na Garagem' : 'Faltando';
  const badgeBg = hasItem ? 'rgba(22, 163, 74, 0.15)' : 'rgba(239, 68, 68, 0.15)';

  const isKaido = !!r.codigo;
  const nomeCarro = r.name || r.modelo;
  const imgCarro = r.image || r.caminho_imagem;
  const seriesOrBrand = isKaido ? (r.fabricante || 'Kaido House') : (r.series || 'Sem Série');
  const partOrCode = isKaido ? r.codigo : (r.part || 'N/A');
  const carYear = isKaido ? (r.ano || 'N/A') : r.year;
  const itemId = isKaido ? r.codigo : r.id;
  const colorVal = isKaido ? (r.cor || 'N/A') : (r.color || 'N/A');

  let valorUnitario = isKaido ? userKaidoPrices[r.codigo] : userPrices[r.id];
  if (typeof valorUnitario === 'undefined') {
    valorUnitario = isKaido ? 180 : (r.series && r.series.toLowerCase().includes('super') ? 150 : 25);
  }

  const valorFormatado = valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  document.getElementById('lb-img').src = imgCarro;

  const lbInfo = document.querySelector('.lb-info');
  if (lbInfo) {
    lbInfo.innerHTML = `
      <button onclick="document.getElementById('lightbox').style.display='none'" style="position: absolute; top: 15px; right: 15px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 20px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">✕</button>
      
      <div class="lb-details-title">${nomeCarro}</div>
      <div class="lb-stat-row">
        <span class="lb-stat-label">Série / Marca</span>
        <span class="lb-stat-value">${seriesOrBrand}</span>
      </div>
      <div class="lb-stat-row">
        <span class="lb-stat-label">Ano</span>
        <span class="lb-stat-value">${carYear}</span>
      </div>
      <div class="lb-stat-row">
        <span class="lb-stat-label">Cor</span>
        <span class="lb-stat-value">${colorVal}</span>
      </div>
      <div class="lb-stat-row">
        <span class="lb-stat-label">Lote / SKU</span>
        <span class="lb-stat-value">${partOrCode}</span>
      </div>
      <div class="lb-stat-row">
        <span class="lb-stat-label">Preço Pago (Unid)</span>
        <span class="lb-stat-value" style="color: #10b981; font-weight: bold;">${valorFormatado}</span>
      </div>
      ${hasItem ? `
        <button onclick="window.alterarPrecoItem('${itemId}', ${isKaido})" style="margin-top: 15px; background: #475569; color: #fff; border: 1px solid #64748b; padding: 8px 12px; border-radius: 6px; font-family: 'Barlow', sans-serif; font-size: 13px; cursor: pointer; transition: 0.2s; font-weight: 500;">
          ✏️ Editar Preço Pago
        </button>
      ` : ''}
      <div class="lb-status-badge" style="color: ${badgeColor}; background: ${badgeBg}; border: 1px solid ${badgeColor}; margin-top: 20px; margin-bottom: 20px;">
        ${badgeText}
      </div>
    `;
  }

  document.getElementById('lb-counter').textContent = `${lbIndex + 1} de ${listaAtual.length}`;
  document.getElementById('lightbox').style.display = 'flex';
}

function closeLb() {
  document.getElementById('lightbox').style.display = 'none';
}

const lbCloseBtn = document.getElementById('lb-close-btn');
if (lbCloseBtn) lbCloseBtn.addEventListener('click', closeLb);

const lbPrevBtn = document.getElementById('lb-prev');
if (lbPrevBtn) {
  lbPrevBtn.addEventListener('click', () => {
    if (lbIndex > 0) openLb(lbIndex - 1);
  });
}

const lbNextBtn = document.getElementById('lb-next');
if (lbNextBtn) {
  lbNextBtn.addEventListener('click', () => {
    const listaAtual = window.currentFilteredData || PAGE_DATA;
    if (lbIndex < listaAtual.length - 1) openLb(lbIndex + 1);
  });
}

document.addEventListener('keydown', (e) => {
  const lightbox = document.getElementById('lightbox');
  if (lightbox && lightbox.style.display === 'flex') {
    const listaAtual = window.currentFilteredData || PAGE_DATA;

    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft' && lbIndex > 0) openLb(lbIndex - 1);
    if (e.key === 'ArrowRight' && lbIndex < listaAtual.length - 1) openLb(lbIndex + 1);
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
const caseInput = document.getElementById('filter-cas');
const filterOwnedCheckbox = document.getElementById('filter-owned-only');

if (searchInput) searchInput.addEventListener('input', () => { currentPage = 1; render(); });
if (yearInput) yearInput.addEventListener('change', () => { currentPage = 1; render(); });
if (eraInput) eraInput.addEventListener('change', () => { currentPage = 1; render(); });
if (seriesInput) seriesInput.addEventListener('change', () => { currentPage = 1; render(); });
if (caseInput) caseInput.addEventListener('change', () => { currentPage = 1; render(); });
if (filterOwnedCheckbox) filterOwnedCheckbox.addEventListener('change', () => { currentPage = 1; render(); });

const btnClear = document.getElementById('btn-clear');
if (btnClear) {
  btnClear.addEventListener('click', () => {
    currentPage = 1;
    if (searchInput) searchInput.value = '';
    if (yearInput) yearInput.value = '';
    if (eraInput) eraInput.value = '';
    if (seriesInput) seriesInput.value = '';
    if (caseInput) caseInput.value = '';
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

window.renderMissions = function () {
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

window.renderRewards = async function () {
  const container = document.getElementById('rewards-view');
  if (!container) return;

  const premiosDestaLoja = typeof LISTA_RECOMPENSAS !== 'undefined'
    ? LISTA_RECOMPENSAS.filter(item => item.lojaOrigem === window.lojaAtiva)
    : [];

  const saldoNestaLoja = window.userPointsMap[window.lojaAtiva] || 0;

  const pointsEl = document.getElementById('user-points');
  if (pointsEl) pointsEl.textContent = saldoNestaLoja;


  let menuHTML = '';
  if (window.minhasLojasArray && window.minhasLojasArray.length > 1) {
    const options = window.minhasLojasArray.map(loja => `<option value="${loja}" ${window.lojaAtiva === loja ? 'selected' : ''}>${loja}</option>`).join('');
    menuHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px; background: rgba(250, 204, 21, 0.15); padding: 12px; border-radius: 8px; border: 1px solid #facc15;">
          <span style="font-family: 'Bebas Neue', sans-serif; font-size: 18px; color: #facc15; letter-spacing: 1px;">ESCOLHER VENDEDOR:</span>
          <select onchange="window.mudarLojaAtiva(this.value)" style="background: var(--surface2); color: #fff; border: 1px solid #facc15; padding: 8px; border-radius: 4px; font-family: 'Barlow', sans-serif; font-size: 14px; outline: none; cursor: pointer; flex-grow: 1;">
            ${options}
          </select>
        </div>
      `;
  }

  let cardsHTML = '';
  if (premiosDestaLoja.length > 0) {
    premiosDestaLoja.forEach(item => {
      const canAfford = saldoNestaLoja >= item.custo;
      cardsHTML += `
          <div class="reward-card" style="position: relative;">
              <span style="position: absolute; top: 10px; right: 10px; background: #334155; color: #cbd5e1; font-size: 10px; font-weight: bold; padding: 4px 8px; border-radius: 4px; text-transform: uppercase;">
                  ${item.lojaOrigem}
              </span>
              <div class="reward-icon">${item.icone}</div>
              <h3>${item.titulo}</h3>
              <p>${item.desc}</p>
              <div class="reward-cost">🪙 ${item.custo} RPMs</div>
              <button class="btn-redeem" ${!canAfford ? 'disabled' : ''} onclick="window.redeemReward('${item.id}', ${item.custo}, '${item.titulo}', '${item.wppOrigem}', '${item.lojaOrigem}')">
                ${canAfford ? 'Resgatar Prêmio' : 'Pontos Insuficientes'}
              </button>
          </div>
        `;
    });
  } else {
    cardsHTML = `<div style="color: #94a3b8; text-align: center; width: 100%; padding: 20px;">Nenhuma recompensa disponível nesta loja no momento.</div>`;
  }

  let cuponsHTML = '';
  if (typeof userRewards !== 'undefined' && userRewards && userRewards.length > 0) {
    let linhasCupons = userRewards.map(resgate => `
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 12px; font-family: 'Barlow Condensed', sans-serif; font-weight: 600; color: #fff;">${resgate.data}</td>
        <td style="padding: 12px; color: var(--yellow); font-weight: 500; font-size: 14px;">${resgate.titulo}</td>
        <td style="padding: 12px;"><span style="font-family: monospace; background: var(--surface2); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); color: #fff; font-size: 13px; letter-spacing: 1px;">${resgate.codigo}</span></td>
        <td style="padding: 12px;"><span style="background: rgba(34, 197, 94, 0.15); color: var(--green); border: 1px solid rgba(34, 197, 94, 0.3); padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase;">${resgate.status}</span></td>
      </tr>
    `).join('');
    cuponsHTML = `<div style="margin-top: 40px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px;"><h3 style="font-family: 'Bebas Neue', sans-serif; font-size: 26px; color: #fff; margin-bottom: 16px;">🎟️ Meus Cupons</h3><table style="width: 100%; border-collapse: collapse;"><thead><tr style="border-bottom: 2px solid var(--border); color: var(--muted); font-size: 11px;"><th style="padding: 12px; text-transform: uppercase;">Data</th><th style="padding: 12px; text-transform: uppercase;">Prêmio</th><th style="padding: 12px; text-transform: uppercase;">Código</th><th style="padding: 12px; text-transform: uppercase;">Status</th></tr></thead><tbody>${linhasCupons}</tbody></table></div>`;
  }

  container.innerHTML = `
    ${menuHTML}
    <div class="reward-grid">
        ${cardsHTML}
    </div>
    ${cuponsHTML}
  `;
}


window.mudarLojaAtiva = function (novaLoja) {
  window.lojaAtiva = novaLoja;
  renderRewards();
  if (typeof renderSorteios === 'function') renderSorteios();
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

    const whatsappNumber = window.lojaWhatsapp;
    const msgWpp = encodeURIComponent(`Fala mestre! Acabei de resgatar o prêmio "${options.title}" lá no site. Meu cupom é: ${options.code}`);

    if (typeof confetti === 'function') {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#facc15', '#3b82f6', '#10b981', '#a855f7'],
        zIndex: 10005
      });
    }

    innerHTML = `
      <div class="custom-modal-box">
        <div class="custom-modal-icon">🎉</div>
        <div class="custom-modal-title" style="color: var(--green);">SUCESSO!</div>
        <div class="custom-modal-text">O prêmio "<b>${options.title}</b>" é seu! Salve o código abaixo:</div>
        <div class="custom-modal-code" style="font-size: 24px; font-weight: bold; background: #0f172a; padding: 10px; border-radius: 8px; margin: 15px 0; color: #fff; letter-spacing: 2px;">${options.code}</div>
        <div class="custom-modal-actions" style="display: flex; flex-direction: column; gap: 10px;">
          <a href="https://wa.me/${whatsappNumber}?text=${msgWpp}" target="_blank" class="btn-modal confirm" style="text-decoration: none; text-align: center; background: #25D366; color: white; display: block; border-radius: 6px; padding: 12px; font-weight: bold;">📲 Avisar no WhatsApp</a>
          <button class="btn-modal cancel" onclick="document.getElementById('hw-custom-modal').remove()" style="width: 100%;">Fechar Janela</button>
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
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="500">500</option>
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





    const btnOwned = document.getElementById('kaido-filter-owned');
    if (btnOwned) {
      btnOwned.addEventListener('click', (e) => {
        showingOnlyOwnedKaido = !showingOnlyOwnedKaido;
        e.target.style.background = showingOnlyOwnedKaido ? '#c084fc' : '#1e293b';
        e.target.style.color = showingOnlyOwnedKaido ? '#000' : '#cbd5e1';
        window.kaidoCurrentPage = 1;
        window.renderKaidoGrid();
      });
    }

    const btnWish = document.getElementById('kaido-filter-wishlist');
    if (btnWish) {
      btnWish.addEventListener('click', (e) => {
        showingOnlyWishlistKaido = !showingOnlyWishlistKaido;
        e.target.style.background = showingOnlyWishlistKaido ? '#ef4444' : '#1e293b';
        e.target.style.color = showingOnlyWishlistKaido ? '#fff' : '#cbd5e1';
        window.kaidoCurrentPage = 1;
        window.renderKaidoGrid();
      });
    }


    const searchInput = document.getElementById('kaido-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        window.kaidoCurrentPage = 1;
        window.renderKaidoGrid();
      });
    }


    const selectPage = document.getElementById('kaido-per-page-select');
    if (selectPage) {
      selectPage.addEventListener('change', (e) => {
        window.kaidoItemsPerPage = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
        window.kaidoCurrentPage = 1;
        window.renderKaidoGrid();
      });
    }

    const btnPrev = document.getElementById('kaido-btn-prev');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (window.kaidoCurrentPage > 1) {
          window.kaidoCurrentPage--;
          window.renderKaidoGrid();
        }
      });
    }

    const btnNext = document.getElementById('kaido-btn-next');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        const inputBusca = document.getElementById('kaido-search');
        const query = inputBusca ? inputBusca.value.toLowerCase().trim() : '';

        const filteredData = KAIDO_DATA.filter(car => {

          const matchesSearch = !query ||
            (car.modelo && car.modelo.toLowerCase().includes(query)) ||
            (car.codigo && car.codigo.toLowerCase().includes(query)) ||
            (car.marca && car.marca.toLowerCase().includes(query));

          const matchesOwned = !isOwnedActive || (ownedKaidos[car.codigo] > 0);
          const matchesWish = !isWishActive || wishKaidos[car.codigo];

          let matchesGlobalSearch = true;
          if (window.searchTerms) {
            matchesGlobalSearch =
              (car.modelo && car.modelo.toLowerCase().includes(window.searchTerms)) ||
              (car.codigo && car.codigo.toLowerCase().includes(window.searchTerms)) ||
              (car.fabricante && car.fabricante.toLowerCase().includes(window.searchTerms));
          }

          let matchesTrocas = true;
          if (window.showOnlyTrades) {
            const qtyRepetido = ownedKaidos[car.codigo] || 0;
            matchesTrocas = qtyRepetido > 1;
          }

          return matchesSearch && matchesOwned && matchesWish && matchesGlobalSearch && matchesTrocas;
        });

        const maxPages = window.kaidoItemsPerPage === 'all' ? 1 : Math.ceil(filteredData.length / window.kaidoItemsPerPage);
        if (window.kaidoCurrentPage < maxPages) {
          window.kaidoCurrentPage++;
          window.renderKaidoGrid();
        }
      });
    }
  }

  window.renderKaidoGrid();
};


window.renderKaidoGrid = function () {
  const grid = document.getElementById('kaido-grid');
  const searchInput = document.getElementById('kaido-search');
  if (!grid || !searchInput) return;

  const query = searchInput.value.toLowerCase().trim();
  grid.innerHTML = '';


  const ownedKaidos = (typeof userKaidoCollection !== 'undefined' && userKaidoCollection) ? userKaidoCollection : {};
  const wishKaidos = (typeof userWishlist !== 'undefined' && userWishlist) ? userWishlist : {};
  const isOwnedActive = (typeof showingOnlyOwnedKaido !== 'undefined') ? showingOnlyOwnedKaido : false;
  const isWishActive = (typeof showingOnlyWishlistKaido !== 'undefined') ? showingOnlyWishlistKaido : false;


  const filteredData = KAIDO_DATA.filter(car => {

    const matchesSearch = !query ||
      (car.modelo && car.modelo.toLowerCase().includes(query)) ||
      (car.codigo && car.codigo.toLowerCase().includes(query)) ||
      (car.marca && car.marca.toLowerCase().includes(query));


    const matchesOwned = !isOwnedActive || (ownedKaidos[car.codigo] > 0);


    const matchesWish = !isWishActive || wishKaidos[car.codigo];

    return matchesSearch && matchesOwned && matchesWish;
  });


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


  dataToRender.forEach(car => {
    const qty = ownedKaidos[car.codigo] || 0;
    const repetidos = qty > 1 ? qty - 1 : 0;
    const has = qty > 0;

    const card = document.createElement('div');
    card.className = `car-card ${has ? 'owned-card' : ''} holographic-kaido`;

    let optionsHTML = '';
    for (let i = 0; i <= 50; i++) {
      optionsHTML += `<option value="${i}" ${i === qty ? 'selected' : ''}>${i}</option>`;
    }

    let controlesHTML = `
      <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
        <button class="btn-minus-kaido" style="padding: 8px 15px; background: #334155; color: white; border: 1px solid #475569; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 18px;" ${qty === 0 ? 'disabled style="opacity: 0.5;"' : ''}>-</button>
        <div style="flex: 1; text-align: center; background: #0f172a; border: 1px solid #475569; color: var(--yellow); border-radius: 6px; padding: 8px; font-weight: bold; font-size: 16px;">${qty}</div>
        <button class="btn-plus-kaido" style="padding: 8px 15px; background: #16a34a; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 18px;">+</button>
        ${repetidos > 0 ? `<span class="rep-badge" style="background: #ffedd5; color: #ea580c; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 11px;">+${repetidos}</span>` : ''}
      </div>`;

    card.innerHTML = `
      <div class="car-image-container" style="position: relative; cursor: pointer;">
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

    if (card.querySelector('.car-image-container')) {
      card.querySelector('.car-image-container').addEventListener('click', () => {
        window.currentFilteredData = filteredData;
        openLb(filteredData.indexOf(car));
      });
    }

    const btnMinus = card.querySelector('.btn-minus-kaido');
    const btnPlus = card.querySelector('.btn-plus-kaido');

    if (btnMinus) {
      btnMinus.addEventListener('click', () => {
        if (qty > 0) {
          if (window.saveKaidoData) window.saveKaidoData(car.codigo, qty - 1);
          setTimeout(() => window.renderKaidoGrid(), 50);
        }
      });
    }

    if (btnPlus) {
      btnPlus.addEventListener('click', () => {
        if (window.saveKaidoData) window.saveKaidoData(car.codigo, qty + 1);
        setTimeout(() => window.renderKaidoGrid(), 50);
      });
    }
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
  let anosCount = {};
  let patrimonioEstimado = 0;

  Object.keys(userCollection).forEach(carId => {
    let qty = userCollection[carId];
    if (qty > 0) {
      totalHW += qty;
      let car = RAW.find(r => r && r.id === carId);

      let valorUnitario = userPrices[carId];
      if (typeof valorUnitario === 'undefined') {
        valorUnitario = 25;
        if (car) {
          if (car.year) anosCount[car.year] = (anosCount[car.year] || 0) + qty;
          if (car.series && car.series.toLowerCase().includes('super')) valorUnitario = 150;
          if (car.price) valorUnitario = parseFloat(car.price);
        }
      } else {
        if (car && car.year) anosCount[car.year] = (anosCount[car.year] || 0) + qty;
      }
      patrimonioEstimado += (valorUnitario * qty);
    }
  });

  Object.keys(userKaidoCollection).forEach(codigo => {
    let qty = userKaidoCollection[codigo];
    if (qty > 0) {
      totalKaido += qty;
      let valorKaido = userKaidoPrices[codigo];
      if (typeof valorKaido === 'undefined') valorKaido = 180;
      patrimonioEstimado += (valorKaido * qty);
    }
  });

  Object.values(userWishlist).forEach(wished => { if (wished) totalWishlist++; });

  const hwPossuidos = Object.keys(userCollection).filter(k => userCollection[k] > 0).length;
  const pctHW = RAW.length > 0 ? ((hwPossuidos / RAW.length) * 100).toFixed(2) : 0;

  let anosOrdenados = Object.keys(anosCount).sort((a, b) => anosCount[b] - anosCount[a]).slice(0, 5);
  let valoresAnos = anosOrdenados.map(ano => anosCount[ano]);

  const valorFormatado = patrimonioEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; flex-wrap: wrap; gap: 15px;">
        <div>
            <h2 style="font-family: 'Bebas Neue', sans-serif; color: #fff; font-size: 32px; margin: 0; letter-spacing: 1px;">Visão Geral da Garagem</h2>
            <p style="color: var(--muted); font-size: 14px;">Acompanhe o crescimento e a valorização do seu império diecast.</p>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button onclick="window.gerarInfografico()" style="background: #3b82f6; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-family: 'Bebas Neue', sans-serif; font-size: 18px; cursor: pointer; letter-spacing: 1px; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);">
                📸 Compartilhar Status
            </button>
        </div>
    </div>
    
    <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 25px; border-radius: 12px; border: 1px solid #10b981; margin-bottom: 25px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
        <div>
            <div style="color: #10b981; font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px;">Patrimônio Estimado</div>
            <div style="color: #fff; font-size: 36px; font-weight: bold; font-family: 'Bebas Neue', sans-serif;">${valorFormatado}</div>
        </div>
        <div style="background: rgba(16, 185, 129, 0.15); padding: 10px 20px; border-radius: 8px; color: #10b981; font-weight: bold; font-size: 14px; border: 1px solid rgba(16, 185, 129, 0.3);">
            📈 Base de Cálculo: Preços Registrados
        </div>
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

    <div style="background: var(--surface); padding: 24px; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 30px;">
        <h3 style="color: #fff; margin-top: 0; margin-bottom: 15px; font-family: 'Bebas Neue'; font-size: 24px;">Progresso da Coleção (HW)</h3>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #cbd5e1; font-weight: bold;">
            <span>Percentual completo do catálogo</span>
            <span style="color: var(--yellow);">${pctHW}%</span>
        </div>
        <div style="width: 100%; background: #0f172a; border-radius: 10px; height: 12px; overflow: hidden; border: 1px solid #334155;">
            <div style="width: ${pctHW}%; background: linear-gradient(90deg, #facc15, #f59e0b); height: 100%; border-radius: 10px;"></div>
        </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
        <div style="background: var(--surface); padding: 20px; border-radius: 12px; border: 1px solid var(--border); display: flex; flex-direction: column; align-items: center;">
            <h3 style="color: #cbd5e1; margin-top: 0; margin-bottom: 20px; font-size: 16px; font-family: 'Barlow Condensed'; text-transform: uppercase;">Proporção da Coleção</h3>
            <div style="position: relative; width: 100%; max-width: 250px; aspect-ratio: 1;">
                <canvas id="chartMarcas"></canvas>
            </div>
        </div>
        
        <div style="background: var(--surface); padding: 20px; border-radius: 12px; border: 1px solid var(--border); display: flex; flex-direction: column; align-items: center;">
            <h3 style="color: #cbd5e1; margin-top: 0; margin-bottom: 20px; font-size: 16px; font-family: 'Barlow Condensed'; text-transform: uppercase;">Top 5 Anos (HW)</h3>
            <div style="position: relative; width: 100%; height: 250px;">
                <canvas id="chartAnos"></canvas>
            </div>
        </div>
    </div>
  `;

  // --- TIMELINE DE ÚLTIMAS AQUISIÇÕES ---
  const chavesCompradas = Object.keys(userCollection || {}).filter(k => userCollection[k] > 0);
  const ultimas = chavesCompradas.slice(-5).reverse(); // Pega os últimos 5

  let timelineHTML = `
    <div style="margin-top: 30px; margin-bottom: 30px; background: var(--surface); border-radius: 12px; padding: 20px; border: 1px solid var(--border);">
        <h3 style="font-family: 'Bebas Neue', sans-serif; color: #fff; font-size: 24px; margin-top: 0; margin-bottom: 15px;">⏱️ Últimas Aquisições (Hot Wheels)</h3>
        <div style="display: flex; flex-direction: column; gap: 10px;">`;

  if (ultimas.length === 0) {
    timelineHTML += `<div style="color: var(--muted); font-size: 14px;">Nenhuma miniatura na garagem ainda.</div>`;
  } else {
    ultimas.forEach(id => {
      const carro = typeof RAW !== 'undefined' ? RAW.find(c => c && c.id === id) : null;
      if (carro) {
        timelineHTML += `
                <div style="display: flex; align-items: center; gap: 15px; background: #0f172a; padding: 10px; border-radius: 8px; border: 1px solid #475569;">
                    <img src="${carro.image || 'assets/img/placeholder.png'}" loading="lazy" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;">
                    <div>
                        <div style="font-weight: bold; color: #fff; font-size: 16px;">${carro.name}</div>
                        <div style="font-size: 12px; color: #94a3b8;">${carro.series || 'Sem série'} | Ano: ${carro.year}</div>
                    </div>
                </div>`;
      }
    });
  }
  timelineHTML += `</div></div>`;

  const timelineDiv = document.createElement('div');
  timelineDiv.innerHTML = timelineHTML;
  container.appendChild(timelineDiv);

  setTimeout(() => {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Barlow', sans-serif";

    new Chart(document.getElementById('chartMarcas'), {
      type: 'doughnut',
      data: {
        labels: ['Hot Wheels', 'Kaido House'],
        datasets: [{
          data: [totalHW, totalKaido],
          backgroundColor: ['#facc15', '#c084fc'],
          borderColor: '#1e293b',
          borderWidth: 4,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });

    new Chart(document.getElementById('chartAnos'), {
      type: 'bar',
      data: {
        labels: anosOrdenados.length > 0 ? anosOrdenados : ['N/A'],
        datasets: [{
          label: 'Qtd de Miniaturas',
          data: valoresAnos.length > 0 ? valoresAnos : [0],
          backgroundColor: 'rgba(56, 189, 248, 0.8)',
          borderColor: '#38bdf8',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }, 100);
};

window.renderSorteios = function () {
  const view = document.getElementById('sorteios-view');
  if (!view) return;


  const whatsappNumber = window.lojaWhatsapp;


  let adminButtons = '';
  if (targetRole === 'admin' || targetRole === 'gerente') {
    adminButtons = `
        <div style="display: flex; gap: 15px; justify-content: center; margin-bottom: 30px;">
            <button onclick="abrirModalRifa()" style="background: #a855f7; color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 20px; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; box-shadow: 0 4px 10px rgba(168, 85, 247, 0.3);">➕ Adicionar Nova Rifa</button>
            <button onclick="abrirSorteadorDaRifa()" style="background: #10b981; color: #000; font-family: 'Bebas Neue', sans-serif; font-size: 20px; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);">🎲 Sorteador Livre</button>
        </div>
    `;
  }

  let html = `
        <div style="background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid #334155; padding: 30px; border-radius: 12px; margin-bottom: 25px; text-align: center;">
            <h2 style="font-family: 'Bebas Neue', sans-serif; color: #a855f7; font-size: 36px; margin: 0 0 10px 0; letter-spacing: 1px;">🎟️ Rifas Exclusivas VIP</h2>
            <p style="color: #cbd5e1; font-size: 16px; max-width: 600px; margin: 0 auto;">Garanta seus números! Além da chance de ganhar a miniatura, cada número comprado rende <b>RPMs</b> para trocar por prêmios na loja.</p>
        </div>
        ${adminButtons}
        <h3 style="font-family: 'Bebas Neue', sans-serif; color: #fff; font-size: 24px; margin-bottom: 15px;">Rifas Ativas</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
    `;

  if (!window.LISTA_RIFAS || window.LISTA_RIFAS.length === 0) {
    html += `<div style="grid-column: 1 / -1; background: #1e293b; padding: 30px; text-align: center; border-radius: 12px; border: 1px dashed #475569; color: #94a3b8;">Nenhum sorteio ativo no momento. Fique de olho!</div>`;
  } else {
    window.LISTA_RIFAS.forEach((r, index) => {

      const isConcluida = r.status === 'Concluído';


      let adminControls = '';
      let btnSortearDireto = '';

      if (targetRole === 'admin' || targetRole === 'gerente') {

        const safeTitle = r.titulo.replace(/'/g, "\\'");


        if (!isConcluida) {
          btnSortearDireto = `<button onclick="abrirSorteadorDaRifa('${safeTitle}')" style="background: #10b981; color: #000; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 1px; transition: 0.2s; box-shadow: 0 4px 10px rgba(16,185,129,0.3);">🎲 Sortear</button>`;
        }


        adminControls = `
            <div style="display: flex; gap: 8px; margin-top: 15px;">
                <button onclick="editarRifa(${index})" style="flex: 1; background: #3b82f6; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold;">✏️ Editar</button>
                <button onclick="excluirRifa(${index})" style="flex: 1; background: #ef4444; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold;">🗑️ Excluir</button>
                ${!isConcluida ? `<button onclick="concluirRifa(${index})" style="flex: 1; background: #10b981; color: #000; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold;">✅ Concluir</button>` : ''}
            </div>
        `;
      }


      const btnCompra = !isConcluida
        ? `<a href="https://wa.me/${whatsappNumber}?text=Olá! Gostaria de reservar números para a rifa: ${r.titulo}" target="_blank" style="background: #a855f7; color: #fff; text-decoration: none; padding: 10px 15px; border-radius: 6px; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 1px; transition: 0.2s; display: flex; align-items: center;">Comprar</a>`
        : `<span style="background: #475569; color: #fff; padding: 10px 15px; border-radius: 6px; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 1px; display: flex; align-items: center; cursor: not-allowed;">Encerrada</span>`;

      html += `
        <div style="background: #1e293b; border: 1px solid ${isConcluida ? '#10b981' : '#334155'}; border-radius: 12px; overflow: hidden; position: relative; opacity: ${isConcluida ? '0.8' : '1'};">
            <img src="${r.imagem}" style="width: 100%; height: 220px; object-fit: contain; background-color: #0f172a; border-radius: 8px 8px 0 0;" filter: ${isConcluida ? 'grayscale(100%)' : 'none'};" onerror="this.src='assets/img/placeholder.png'">
            <span style="position: absolute; top: 10px; right: 10px; background: ${isConcluida ? '#10b981' : '#22c55e'}; color: #000; font-size: 11px; font-weight: bold; padding: 4px 8px; border-radius: 4px; text-transform: uppercase;">
                ${isConcluida ? 'Concluída' : 'Ativo'}
            </span>
            
            <div style="padding: 20px;">
                <h4 style="color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 24px; margin: 0 0 5px 0; letter-spacing: 0.5px;">${r.titulo}</h4>
                <p style="color: #94a3b8; font-size: 14px; margin-top: 0; min-height: 40px;">${r.desc}</p>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 15px; border-top: 1px dashed #475569;">
                    <div>
                        <div style="color: ${isConcluida ? '#94a3b8' : '#facc15'}; font-weight: bold; font-size: 20px;">R$ ${r.preco}</div>
                        <div style="color: #64748b; font-size: 12px;">Ganhe +${r.rpms} RPMs / nº</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        ${btnSortearDireto}
                        ${btnCompra}
                    </div>
                </div>
                ${adminControls}
            </div>
        </div>
      `;
    });
  }
  html += `</div>`;
  view.innerHTML = html;
};




window.concluirRifa = async function (index) {
  if (!confirm('Deseja marcar esta rifa como CONCLUÍDA?\n\nEla não aceitará mais novas reservas e mudará visualmente para Encerrada.')) return;

  try {
    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");


    window.LISTA_RIFAS[index].status = 'Concluído';


    await setDoc(doc(db, 'lojas', window.lojaIdAtual), { rifas: window.LISTA_RIFAS }, { merge: true });


    window.renderSorteios();
  } catch (e) {
    console.error("Erro ao concluir rifa:", e);
    alert('Erro ao atualizar o status da rifa.');
  }
};




window.abrirSorteadorDaRifa = function (tituloDaRifa = 'Sorteio da Rifa') {
  const modal = document.getElementById('modal-sorteador');
  if (modal) {

    const titleH2 = modal.querySelector('h2');
    if (titleH2) {
      titleH2.innerHTML = tituloDaRifa !== 'Sorteio da Rifa'
        ? `SORTEIO: <span style="color: #fff; font-size: 32px; display:block; margin-top: 4px;">${tituloDaRifa}</span>`
        : 'Sorteio da Rifa';
    }


    const resultEl = document.getElementById('sort-result');
    const winnerEl = document.getElementById('sort-winner-name');
    const participantsEl = document.getElementById('sort-participants');

    if (resultEl) {
      resultEl.textContent = '000';
      resultEl.style.color = '#fff';
      resultEl.style.transform = 'scale(1)';
    }
    if (winnerEl) {
      winnerEl.textContent = '';
      winnerEl.style.opacity = '0';
    }
    if (participantsEl) participantsEl.value = '';

    modal.style.display = 'flex';
  }
}








window.abrirModalRifa = function () {
  document.getElementById('rifa-edit-index').value = -1;
  document.getElementById('rifa-form-titulo').value = '';
  document.getElementById('rifa-form-desc').value = '';
  document.getElementById('rifa-form-preco').value = '';
  document.getElementById('rifa-form-rpms').value = '';
  
  // Limpa o campo de foto e o preview
  document.getElementById('rifa-form-imagem-file').value = '';
  document.getElementById('rifa-form-imagem-base64').value = '';
  const preview = document.getElementById('rifa-form-imagem-preview');
  preview.src = '';
  preview.style.display = 'none';

  document.getElementById('modal-rifa-title').innerText = 'Criar Nova Rifa';
  document.getElementById('modal-rifa-form').style.display = 'flex';
}

window.editarRifa = function (index) {
  const r = window.LISTA_RIFAS[index];
  document.getElementById('rifa-edit-index').value = index;
  document.getElementById('rifa-form-titulo').value = r.titulo;
  document.getElementById('rifa-form-desc').value = r.desc;
  document.getElementById('rifa-form-preco').value = r.preco;
  document.getElementById('rifa-form-rpms').value = r.rpms;
  
  // Carrega a foto existente no modo edição
  document.getElementById('rifa-form-imagem-file').value = '';
  document.getElementById('rifa-form-imagem-base64').value = r.imagem || '';
  const preview = document.getElementById('rifa-form-imagem-preview');
  if (r.imagem) {
    preview.src = r.imagem;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }

  document.getElementById('modal-rifa-title').innerText = 'Editar Rifa';
  document.getElementById('modal-rifa-form').style.display = 'flex';
}

window.salvarRifa = async function () {
  const index = parseInt(document.getElementById('rifa-edit-index').value);
  const titulo = document.getElementById('rifa-form-titulo').value.trim();
  const desc = document.getElementById('rifa-form-desc').value.trim();
  const preco = document.getElementById('rifa-form-preco').value.trim();
  const rpms = document.getElementById('rifa-form-rpms').value;
  
  // Pega a foto comprimida do campo invisível
  const imagem = document.getElementById('rifa-form-imagem-base64').value;

  if (!titulo || !preco || !rpms) return alert('Por favor, preencha o Título, Preço e RPMs!');

  const rifaData = { titulo, imagem, desc, preco, rpms, status: 'Ativo' };

  if (index >= 0) {
    rifaData.id = window.LISTA_RIFAS[index].id;
    rifaData.status = window.LISTA_RIFAS[index].status || 'Ativo';
    window.LISTA_RIFAS[index] = rifaData;
  } else {
    rifaData.id = 'rifa_' + Date.now();
    window.LISTA_RIFAS.push(rifaData);
  }

  try {
    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    await setDoc(doc(db, 'lojas', window.lojaIdAtual), { rifas: window.LISTA_RIFAS }, { merge: true });

    document.getElementById('modal-rifa-form').style.display = 'none';
    window.renderSorteios();
  } catch (e) {
    console.error("Erro ao salvar a rifa:", e);
    alert('Erro ao comunicar com o servidor.');
  }
}

window.excluirRifa = async function (index) {
  if (!confirm('Tem certeza absoluta que deseja EXCLUIR esta rifa? Esta ação não pode ser desfeita.')) return;

  window.LISTA_RIFAS.splice(index, 1);

  try {
    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    await setDoc(doc(db, 'lojas', window.lojaIdAtual), { rifas: window.LISTA_RIFAS }, { merge: true });
    window.renderSorteios();
  } catch (e) {
    console.error("Erro ao excluir rifa:", e);
    alert('Erro ao excluir do servidor.');
  }
}

window.concluirRifa = async function (index) {
  if (!confirm('Deseja marcar esta rifa como CONCLUÍDA? Ela não aceitará mais novas reservas e mudará visualmente para Encerrada.')) return;

  try {
    window.LISTA_RIFAS[index].status = 'Concluído';
    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");

    await setDoc(doc(db, 'lojas', window.lojaIdAtual), { rifas: window.LISTA_RIFAS }, { merge: true });
    window.renderSorteios();
  } catch (e) {
    console.error("Erro ao concluir rifa:", e);
    alert('Erro ao atualizar o status da rifa.');
  }
};




window.realizarSorteioVirtual = function () {
  const minVal = parseInt(document.getElementById('sort-min').value);
  const maxVal = parseInt(document.getElementById('sort-max').value);
  const participantsText = document.getElementById('sort-participants').value.trim();

  const resultEl = document.getElementById('sort-result');
  const nameEl = document.getElementById('sort-winner-name');

  let participants = [];


  if (participantsText) {
    const lines = participantsText.split('\n');
    lines.forEach(line => {
      if (line.trim() !== '') {

        const match = line.match(/^(\d+)[\s\-\.\:]+(.+)$/);
        if (match) {
          participants.push({ num: match[1], name: match[2].trim() });
        } else {

          participants.push({ num: '?', name: line.trim() });
        }
      }
    });
  }


  if (participants.length === 0 && (isNaN(minVal) || isNaN(maxVal) || minVal >= maxVal)) {
    alert("Preencha a lista de participantes ou defina um intervalo numérico válido!");
    return;
  }


  resultEl.style.color = '#fff';
  resultEl.style.transform = 'scale(1)';
  nameEl.textContent = '';
  nameEl.style.opacity = '0';
  let counter = 0;


  const interval = setInterval(() => {

    if (participants.length > 0) {
      const randomP = participants[Math.floor(Math.random() * participants.length)];
      resultEl.textContent = randomP.num !== '?' ? randomP.num : Math.floor(Math.random() * 99);
    } else {
      resultEl.textContent = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
    }

    counter++;


    if (counter > 60) {
      clearInterval(interval);

      if (participants.length > 0) {

        const finalWinner = participants[Math.floor(Math.random() * participants.length)];
        resultEl.textContent = finalWinner.num !== '?' ? finalWinner.num : '🏆';
        nameEl.textContent = finalWinner.name;
        nameEl.style.opacity = '1';
      } else {

        const finalResult = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
        resultEl.textContent = finalResult;
      }

      resultEl.style.color = '#10b981';
      resultEl.style.transform = 'scale(1.2)';
    }
  }, 50);
};


const conviteParams = new URLSearchParams(window.location.search);
const inviteLoja = conviteParams.get('loja');

if (inviteLoja) {
  localStorage.setItem('pendingInvite', inviteLoja);
  window.history.replaceState({}, document.title, window.location.pathname);
}



window.renderEncomendas = async function () {
  const container = document.getElementById('encomendas-view');
  if (!container) return;

  container.innerHTML = '<p style="color: #cbd5e1; text-align: center; margin-top: 40px; font-style: italic;">Buscando suas encomendas no banco de dados...</p>';

  try {

    const clientSelect = document.getElementById('client-select');
    const clienteSelecionado = (clientSelect && clientSelect.value !== 'ME') ? clientSelect.value : null;


    const uidToUse = clienteSelecionado || targetUid || sessionUid;

    if (!uidToUse) {
      container.innerHTML = '<p style="color: var(--red); text-align: center; margin-top: 40px;">Erro: Não foi possível identificar o usuário.</p>';
      return;
    }

    const snap = await getDoc(doc(db, 'collections', uidToUse));
    const data = snap.exists() ? snap.data() : {};
    const garagemLoja = data.garagemLoja || [];

    if (garagemLoja.length === 0) {
      container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; margin-top: 20px;">
                    <h2 style="color: #94a3b8; font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 1px;">Nenhuma encomenda por aqui!</h2>
                    <p style="color: #64748b; font-size: 15px; margin-top: 10px;">Você ainda não tem nenhum item retido nas garagens dos vendedores.</p>
                </div>`;
      return;
    }

    let html = `
            <h2 style="font-family: 'Bebas Neue', sans-serif; color: #60a5fa; font-size: 32px; letter-spacing: 1px; margin-bottom: 5px;">📦 Minhas Encomendas</h2>
            <p style="color: #94a3b8; font-size: 15px; margin-bottom: 25px;">Acompanhe o status dos itens que você adquiriu e estão guardados nas garagens das lojas.</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
        `;


    const encomendasOrdenadas = [...garagemLoja].reverse();

    encomendasOrdenadas.forEach(pedido => {
      let carName = pedido.carId;
      let carImg = 'assets/img/placeholder.png';


      let precoUnitario = parseFloat(pedido.preco || pedido.valor || 0);


      if (typeof RAW !== 'undefined') {
        const carObj = RAW.find(c => c.id === pedido.carId);
        if (carObj) {
          carName = `${carObj.name} <br><small style="color: var(--yellow);">${carObj.year} | SKU: ${carObj.part}</small>`;
          carImg = carObj.image || carImg;


          if (precoUnitario === 0 && carObj.price) {
            precoUnitario = parseFloat(carObj.price);
          }
        }
      }


      const valorTotalPedido = pedido.qty * precoUnitario;



      let btnEditarPreco = '';



      if (window.isAdmin) {
        btnEditarPreco = `
                <button onclick="window.editarPrecoPedido('${pedido.pedidoId}', ${precoUnitario})" 
                    style="background: transparent; color: #94a3b8; border: 1px dashed #475569; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer; margin-left: 8px; transition: 0.2s;"
                    onmouseover="this.style.color='#fff'; this.style.borderColor='#fff'" 
                    onmouseout="this.style.color='#94a3b8'; this.style.borderColor='#475569'">
                    ✏️ Definir Preço
                </button>`;
      }


      let statusBadge = '';

      if (pedido.status === 'pago') {
        statusBadge = '<span style="background: rgba(34, 197, 94, 0.15); color: var(--green); border: 1px solid var(--green); padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; text-transform: uppercase;">🟢 Pago (Na Garagem)</span>';
      } else if (pedido.status === 'enviado') {
        statusBadge = '<span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid #38bdf8; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; text-transform: uppercase;">📦 Enviado / Retirado</span>';
      } else {

        if (valorTotalPedido > 0) {
          statusBadge = `
                    <div style="display: flex; align-items: center;">
                        <button onclick="window.iniciarCheckout('${pedido.pedidoId}', ${valorTotalPedido}, '${pedido.lojaId}')" 
                            style="background: #009ee3; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11px; font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.5px; display: flex; align-items: center; gap: 4px; box-shadow: 0 4px 6px rgba(0,158,227,0.2);">
                            💳 Pagar R$ ${valorTotalPedido.toFixed(2)}
                        </button>
                        ${btnEditarPreco}
                    </div>`;
        } else {
          statusBadge = `
                    <div style="display: flex; align-items: center;">
                        <span style="color: #ef4444; font-size: 11px; font-weight: bold;">⚠️ Preço Indefinido</span>
                        ${btnEditarPreco}
                    </div>`;
        }
      }


      html += `
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; gap: 16px; align-items: center; position: relative; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                <span style="position: absolute; top: 12px; right: 12px; font-size: 10px; background: #334155; color: #cbd5e1; padding: 4px 8px; border-radius: 4px; font-weight: bold; text-transform: uppercase; border: 1px solid #475569;">
                    🏢 ${pedido.lojaId}
                </span>
                
                <img src="${carImg}" style="width: 80px; height: 80px; object-fit: contain; background: #fff; border-radius: 8px;" onerror="this.src='assets/img/placeholder.png';">
                
                <div style="flex: 1; margin-top: 15px;">
                    <div style="color: #e2e8f0; font-weight: 600; font-size: 15px; margin-bottom: 8px; line-height: 1.3;">${carName}</div>
                    <div style="color: #94a3b8; font-size: 13px; margin-bottom: 12px; font-family: 'Barlow', sans-serif;">
                        Unidades: <b style="color: #fff;">${pedido.qty}</b> &nbsp;|&nbsp; Data: ${pedido.data}
                    </div>
                    <div>${statusBadge}</div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;

  } catch (e) {
    console.error("Erro ao buscar encomendas:", e);
    container.innerHTML = '<p style="color: var(--red); text-align: center; margin-top: 40px;">Erro ao carregar as encomendas. Verifique sua conexão.</p>';
  }
}


document.addEventListener('click', (e) => {

  if (e.target && e.target.getAttribute('data-page') === 'encomendas') {
    e.preventDefault();


    const viewsParaEsconder = [
      document.getElementById('table-body'),
      document.getElementById('empty-msg'),
      document.querySelector('.stats-row'),
      document.querySelector('.controls'),
      document.querySelector('.count-bar'),
      document.querySelector('.pagination-container'),
      document.getElementById('missions-view'),
      document.getElementById('rewards-view'),
      document.getElementById('stats-view'),
      document.getElementById('sorteios-view'),
      document.getElementById('kaido-view')
    ];

    viewsParaEsconder.forEach(view => {
      if (view) view.style.display = 'none';
    });


    const mobileSort = document.getElementById('mobile-sort');
    if (mobileSort && mobileSort.parentElement) {
      mobileSort.parentElement.style.display = 'none';
    }


    const titleEl = document.getElementById('dynamic-title');
    if (titleEl) titleEl.innerHTML = 'Minhas <span>Encomendas</span>';


    const encomendasView = document.getElementById('encomendas-view');
    if (encomendasView) {
      encomendasView.style.display = 'block';
      window.renderEncomendas();
    }


    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  }
});





window.venderCarroVisual = async function (carId, event) {

  if (event) event.stopPropagation();


  const clientSelect = document.getElementById('client-select');
  const clienteSelecionado = clientSelect ? clientSelect.value : 'ME';

  if (!clienteSelecionado || clienteSelecionado === 'ME') {
    alert("⚠️ Selecione um cliente na barra superior antes de encomendar!");
    return;
  }

  const qtyInput = prompt("Quantas unidades deste carrinho você está encomendando para o cliente?", "1");
  if (!qtyInput) return;

  const qty = parseInt(qtyInput);
  if (qty <= 0 || isNaN(qty)) {
    alert("Quantidade inválida.");
    return;
  }

  const PONTOS_POR_CARRO = 100;

  try {
    const adminDoc = await getDoc(doc(db, 'users', sessionUid));
    const adminLojaRaw = adminDoc.exists() ? (adminDoc.data().lojaId || '') : '';
    const minhaLojaAtual = adminLojaRaw.split(',')[0].trim() || 'default';

    const dRef = doc(db, 'collections', clienteSelecionado);
    const snap = await getDoc(dRef);
    const dataSnap = snap.exists() ? snap.data() : {};

    let garagemLoja = dataSnap.garagemLoja || [];
    let pointsMap = dataSnap.pointsMap || {};
    let history = dataSnap.history || [];
    let pontosGerais = dataSnap.points || 0;

    const ptsGanhos = qty * PONTOS_POR_CARRO;


    if (typeof dataSnap.points === 'number' && Object.keys(pointsMap).length === 0) {
      pointsMap[minhaLojaAtual] = dataSnap.points;
    }


    pointsMap[minhaLojaAtual] = (pointsMap[minhaLojaAtual] || 0) + ptsGanhos;
    pontosGerais += ptsGanhos;

    history.unshift({
      date: new Date().toLocaleDateString('pt-BR'),
      desc: `Venda via Catálogo (${minhaLojaAtual})`,
      amount: ptsGanhos,
      type: "earning"
    });


    garagemLoja.push({
      pedidoId: 'ped_' + Date.now(),
      carId: carId,
      qty: qty,
      status: 'pendente',
      lojaId: minhaLojaAtual,
      data: new Date().toLocaleDateString('pt-BR')
    });


    await setDoc(dRef, {
      garagemLoja: garagemLoja,
      pointsMap: pointsMap,
      points: pontosGerais,
      history: history
    }, { merge: true });


    if (typeof userPoints !== 'undefined') userPoints = pontosGerais;
    const pointsEl = document.getElementById('user-points');
    if (pointsEl) pointsEl.textContent = pontosGerais;

    alert(`✅ Encomenda registrada com sucesso!\nO item foi para "Minhas Encomendas" e o cliente ganhou +${ptsGanhos} RPMs.`);

  } catch (e) {
    console.error("Erro ao vender carro via catálogo:", e);
    alert("Erro ao registrar a encomenda. Verifique a conexão.");
  }
}

window.iniciarCheckout = async function (pedidoId, valor, lojaDoPedido) {
  try {

    const URL_BACKEND = "https://servidor-pagamentos-hw.onrender.com/checkout";

    const response = await fetch(URL_BACKEND, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pedidoId: pedidoId,
        valor: valor,
        clienteId: sessionUid,
        lojaId: lojaDoPedido
      })
    });

    const resData = await response.json();

    if (resData.init_point) {

      window.location.href = resData.init_point;
    } else if (resData.error) {
      alert("Erro do Servidor: " + resData.error);
    }
  } catch (e) {
    console.error("Erro ao conectar com a API de checkout:", e);
    alert("Não foi possível gerar a tela de pagamento. Verifique a conexão.");
  }
}

window.editarPrecoPedido = async function (pedidoId, precoAtual) {

  const novoPrecoStr = prompt(`Digite o novo preço unitário para este item (Atual: R$ ${precoAtual.toFixed(2)}):\nUse ponto ou vírgula para os centavos.`, precoAtual);


  if (novoPrecoStr === null || novoPrecoStr.trim() === "") return;


  const novoPreco = parseFloat(novoPrecoStr.replace(',', '.'));

  if (isNaN(novoPreco) || novoPreco <= 0) {
    alert("Preço inválido. Digite um número maior que zero.");
    return;
  }

  try {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");


    const pedidoRef = doc(db, 'pedidos', pedidoId);


    await updateDoc(pedidoRef, {
      preco: novoPreco
    });

    alert("Preço atualizado com sucesso!");


    location.reload();

  } catch (error) {
    console.error("Erro ao atualizar preço:", error);
    alert("Erro ao atualizar o banco de dados. Verifique o console.");
  }
}

window.gerarInfografico = function () {
  let totalHW = 0, totalKaido = 0;
  let patrimonioEstimado = 0;

  Object.keys(userCollection).forEach(carId => {
    let qty = userCollection[carId];
    if (qty > 0) {
      totalHW += qty;
      let valorUnitario = userPrices[carId];
      if (typeof valorUnitario === 'undefined') {
        valorUnitario = 25;
        let car = RAW.find(r => r && r.id === carId);
        if (car) {
          if (car.series && car.series.toLowerCase().includes('super')) valorUnitario = 150;
          if (car.price) valorUnitario = parseFloat(car.price);
        }
      }
      patrimonioEstimado += (valorUnitario * qty);
    }
  });

  Object.keys(userKaidoCollection).forEach(codigo => {
    let qty = userKaidoCollection[codigo];
    if (qty > 0) {
      totalKaido += qty;
      let valorKaido = userKaidoPrices[codigo];
      if (typeof valorKaido === 'undefined') valorKaido = 180;
      patrimonioEstimado += (valorKaido * qty);
    }
  });

  const totalCarros = totalHW + totalKaido;
  const valorFormatado = patrimonioEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  let nivelText = 'Piloto Novato 🥉';
  if (totalCarros >= 300) nivelText = 'Magnata Diecast 💎';
  else if (totalCarros >= 150) nivelText = 'Garagem de Elite 🥇';
  else if (totalCarros >= 50) nivelText = 'Colecionador Pro 🥈';

  const infoDiv = document.createElement('div');
  infoDiv.id = 'render-export';
  infoDiv.style.cssText = `
    position: fixed; top: -9999px; left: -9999px;
    width: 1080px; height: 1920px;
    background: linear-gradient(135deg, #0f172a, #1e293b);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: 'Barlow', sans-serif; color: #fff; z-index: -1;
  `;

  infoDiv.innerHTML = `
    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle at 50% 20%, rgba(59, 130, 246, 0.2) 0%, transparent 60%);"></div>
    <div style="z-index: 2; text-align: center; width: 80%;">
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 100px; color: #facc15; margin-bottom: 20px; text-shadow: 0 4px 20px rgba(250, 204, 21, 0.4);">DIECAST MANAGER</div>
        <div style="background: rgba(255,255,255,0.1); padding: 15px 40px; border-radius: 50px; font-size: 35px; display: inline-block; margin-bottom: 80px; border: 2px solid rgba(255,255,255,0.2);">${nivelText}</div>
        
        <div style="display: flex; flex-direction: column; gap: 40px;">
            <div style="background: rgba(15, 23, 42, 0.8); border: 4px solid #3b82f6; border-radius: 30px; padding: 60px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                <div style="font-size: 40px; color: #94a3b8; text-transform: uppercase; font-family: 'Bebas Neue', sans-serif;">Coleção Atual</div>
                <div style="font-size: 140px; font-weight: bold; color: #fff; font-family: 'Bebas Neue', sans-serif; margin: 20px 0;">${totalCarros}</div>
                <div style="font-size: 35px; color: #cbd5e1;">Miniaturas na Garagem</div>
            </div>
            
            <div style="background: rgba(15, 23, 42, 0.8); border: 4px solid #10b981; border-radius: 30px; padding: 60px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                <div style="font-size: 40px; color: #94a3b8; text-transform: uppercase; font-family: 'Bebas Neue', sans-serif;">Patrimônio Estimado</div>
                <div style="font-size: 110px; font-weight: bold; color: #10b981; font-family: 'Bebas Neue', sans-serif; margin: 30px 0;">${valorFormatado}</div>
            </div>
        </div>
        
        <div style="margin-top: 100px; font-size: 30px; color: #64748b;">Acesse e crie sua garagem também!</div>
    </div>
  `;

  document.body.appendChild(infoDiv);

  setTimeout(() => {

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, contextAttributes) {
      if (type === '2d') {
        contextAttributes = contextAttributes || {};
        contextAttributes.willReadFrequently = true;
      }
      return originalGetContext.call(this, type, contextAttributes);
    };

    html2canvas(infoDiv, { scale: 1, useCORS: true, backgroundColor: '#0f172a' }).then(canvas => {
      
      HTMLCanvasElement.prototype.getContext = originalGetContext;

      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert("Erro ao gerar a imagem do infográfico.");
          document.body.removeChild(infoDiv);
          return;
        }

        const file = new File([blob], 'minha_colecao_hw.jpg', { type: 'image/jpeg' });

        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

        if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'Minha Garagem Hot Wheels',
              text: 'Olha o status atual do meu império diecast! 🚀'
            });
          } catch (err) {
            console.log("Compartilhamento cancelado ou falhou:", err);
          }
        } 
    
        else {
          const link = document.createElement('a');
          link.download = 'minha_colecao_hw.jpg';
          link.href = canvas.toDataURL('image/jpeg', 0.9);
          link.click();
        }

        document.body.removeChild(infoDiv);
      }, 'image/jpeg', 0.9);

    }).catch(err => {

      HTMLCanvasElement.prototype.getContext = originalGetContext;
      console.error("Erro no html2canvas:", err);
      document.body.removeChild(infoDiv);
    });
  }, 500);
};

window.alterarPrecoItem = async function (id, isKaido) {
  const currentPrice = isKaido ? (userKaidoPrices[id] || 180) : (userPrices[id] || 25);
  const priceInput = prompt(`Digite o novo valor pago por unidade:`, currentPrice);

  if (priceInput !== null) {
    const newPrice = parseFloat(priceInput.replace(',', '.')) || 0;
    if (isKaido) {
      userKaidoPrices[id] = newPrice;
    } else {
      userPrices[id] = newPrice;
    }

    const uidToSave = targetUid || sessionUid;
    if (uidToSave) {
      try {
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
        const dRef = doc(db, 'collections', uidToSave);
        await setDoc(dRef, {
          prices: userPrices,
          kaidoPrices: userKaidoPrices
        }, { merge: true });
      } catch (e) {
        console.error(e);
      }
    }

    const listaAtual = window.currentFilteredData || PAGE_DATA;
    const index = listaAtual.findIndex(r => (isKaido ? r.codigo : r.id) === id);
    if (index !== -1) openLb(index);
    if (typeof updateCounts === 'function') updateCounts();
  }
};

// // --- LÓGICA DO SCANNER RÁPIDO E GARAGEM DE TROCAS ---
// window.searchTerms = '';
// window.showOnlyTrades = false;

// // Como usamos type="module", o HTML já está pronto. 
// // Podemos anexar os eventos diretamente!
// const searchInputFast = document.getElementById('quick-search');
// const btnTrocas = document.getElementById('btn-trocas');

// if (searchInputFast) {
//   searchInputFast.addEventListener('input', (e) => {
//     window.searchTerms = e.target.value.toLowerCase().trim();
//     currentPage = 1;
//     if (typeof pageType !== 'undefined' && pageType.includes('kaido') && window.renderKaidoGrid) {
//       window.renderKaidoGrid();
//     } else {
//       render();
//     }
//   });
// }

// if (btnTrocas) {
//   btnTrocas.addEventListener('click', (e) => {
//     window.showOnlyTrades = !window.showOnlyTrades;
//     e.target.style.background = window.showOnlyTrades ? '#16a34a' : '#ea580c';
//     e.target.innerHTML = window.showOnlyTrades ? '✅ Mostrando Apenas Repetidos' : '🔄 Garagem de Trocas';
//     currentPage = 1;
    
//     if (typeof pageType !== 'undefined' && pageType.includes('kaido') && window.renderKaidoGrid) {
//       window.renderKaidoGrid();
//     } else {
//       render();
//     }
//   });
// }

// const btnAiScan       = document.getElementById('btn-ai-scan');
// const modalCamera     = document.getElementById('modal-camera');
// const videoPreview    = document.getElementById('camera-preview');
// const canvasCamera    = document.getElementById('camera-canvas');
// const btnCapturar     = document.getElementById('btn-capturar');
// const btnFecharCamera = document.getElementById('btn-fechar-camera');

// let streamAtivo = null;

// async function enviarFrameParaIA(base64Image) {
//   const searchInputFast = document.getElementById('quick-search');
//   const originalPlaceholder = searchInputFast.placeholder;
//   searchInputFast.placeholder = "⏳ A IA está lendo a cartela...";
//   btnAiScan.innerHTML = "⏳";
//   btnAiScan.style.opacity = "0.7";

//   try {
//     const response = await fetch("https://servidor-pagamentos-hw.onrender.com/scan-hotwheels", {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ mimeType: 'image/jpeg', imageBase64: base64Image })
//     });

//     const data = await response.json();
//     if (data.error) throw new Error(data.error);

//     const carroIdentificado = data.result;
//     searchInputFast.value = carroIdentificado;
//     window.searchTerms = carroIdentificado.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
//     currentPage = 1;

//     if (typeof pageType !== 'undefined' && pageType.includes('kaido') && window.renderKaidoGrid) {
//       window.renderKaidoGrid();
//     } else {
//       render();
//     }

//   } catch (error) {
//     console.error(error);
//     alert("Erro na leitura visual. Tente novamente.");
//   } finally {
//     searchInputFast.placeholder = originalPlaceholder;
//     btnAiScan.innerHTML = "📸 IA";
//     btnAiScan.style.opacity = "1";
//   }
// }

// // Abre câmera ao vivo
// btnAiScan.addEventListener('click', async () => {
//   try {
//     streamAtivo = await navigator.mediaDevices.getUserMedia({
//       video: { facingMode: 'environment' } // câmera traseira
//     });
//     videoPreview.srcObject = streamAtivo;
//     modalCamera.style.display = 'flex';
//   } catch (err) {
//     alert("Não foi possível acessar a câmera. Verifique as permissões.");
//   }
// });

// // Fecha câmera
// btnFecharCamera.addEventListener('click', () => {
//   streamAtivo?.getTracks().forEach(t => t.stop());
//   streamAtivo = null;
//   modalCamera.style.display = 'none';
// });

// // Captura frame e envia para IA
// btnCapturar.addEventListener('click', async () => {
//   canvasCamera.width  = videoPreview.videoWidth;
//   canvasCamera.height = videoPreview.videoHeight;
//   canvasCamera.getContext('2d').drawImage(videoPreview, 0, 0);

//   const base64Image = canvasCamera.toDataURL('image/jpeg', 0.85).split(',')[1];

//   // Fecha câmera antes de processar
//   streamAtivo?.getTracks().forEach(t => t.stop());
//   streamAtivo = null;
//   modalCamera.style.display = 'none';

//   await enviarFrameParaIA(base64Image);
// });

// --- COMPRESSOR DE IMAGENS PARA A RIFA ---
document.addEventListener('DOMContentLoaded', () => {
  const fileInputRifa = document.getElementById('rifa-form-imagem-file');
  
  if (fileInputRifa) {
    fileInputRifa.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
          // Cria um canvas para comprimir a imagem (Máx 800px)
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Converte para JPG com 70% de qualidade (Levíssimo pro Firebase)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          document.getElementById('rifa-form-imagem-base64').value = dataUrl;
          const preview = document.getElementById('rifa-form-imagem-preview');
          preview.src = dataUrl;
          preview.style.display = 'block';
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
});
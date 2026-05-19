import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
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
// 1. IDENTIFICAÇÃO DA PÁGINA ATUAL
// ==========================================
const currentPath = window.location.pathname;
let pageType = 'all';

if (currentPath.includes('sth.html')) {
  pageType = 'sth';
} else if (currentPath.includes('th.html')) {
  pageType = 'th';
} else if (currentPath.includes('minha-colecao.html')) {
  pageType = 'owned'; // Identifica a nova página do menu
}

const PAGE_DATA = RAW.filter(r => {
  if (pageType === 'all' || pageType === 'owned') return true;
  if (pageType === 'sth' && r.series && r.series.toLowerCase().includes('super')) return true;
  if (pageType === 'th' && r.series && !r.series.toLowerCase().includes('super')) return true;
  return false;
});

// ==========================================
// 2. ESTADO GLOBAL
// ==========================================
let sessionUid = null;
let userCollection = {};
let sortCol = 'year';
let sortDesc = true;

let currentPage = 1;
let itemsPerPage = 50;
let lbIndex = 0;

// ==========================================
// 3. UTILITÁRIOS
// ==========================================
function getEra(year) {
  if (year >= 2007 && year <= 2011) return 'classic';
  if (year === 2012) return 'secret';
  if (year >= 2013) return 'hidden';
  return 'other';
}

const eraMap = {
  'classic': 'Clássica',
  'secret': 'Super Secret',
  'hidden': 'Hidden',
  'other': 'Outra'
};

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
    series.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      selSeries.appendChild(opt);
    });
  }
}

// ==========================================
// 5. OBTENÇÃO DE DADOS FILTRADOS
// ==========================================
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
  
  // A coleção é mostrada se estiver na página "Minha Coleção" OU se a checkbox estiver ativa
  const isCheckboxChecked = filterOwnedCheckbox ? filterOwnedCheckbox.checked : false;
  const so = (pageType === 'owned') || isCheckboxChecked;

  let filtered = PAGE_DATA.filter(r => {
    let match = true;
    if (sq) {
      match = match && (
        (r.name && r.name.toLowerCase().includes(sq)) ||
        (r.part && r.part.toLowerCase().includes(sq))
      );
    }
    if (sy) match = match && String(r.year) === sy;
    if (se) match = match && getEra(r.year) === se;
    if (ss) match = match && r.series === ss;
    if (so) match = match && isOwned(r); // Aplica o filtro de posse
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
// 6. RENDERIZAÇÃO DA TABELA
// ==========================================
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

  if (perPageSelect) {
    if (itemsPerPage !== 'all') {
      totalPages = Math.ceil(fullData.length / itemsPerPage) || 1;
      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      dataToRender = fullData.slice(start, end);

      if (pageIndicator) {
        pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
        if (btnPrev) {
          btnPrev.disabled = currentPage === 1;
          btnPrev.style.opacity = btnPrev.disabled ? "0.5" : "1";
        }
        if (btnNext) {
          btnNext.disabled = currentPage === totalPages;
          btnNext.style.opacity = btnNext.disabled ? "0.5" : "1";
        }
      }
    } else {
      if (pageIndicator) {
        pageIndicator.textContent = `Página 1 de 1`;
        if (btnPrev) { btnPrev.disabled = true; btnPrev.style.opacity = "0.5"; }
        if (btnNext) { btnNext.disabled = true; btnNext.style.opacity = "0.5"; }
      }
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
          emptyMsg.innerHTML = 'A sua coleção está vazia ou os filtros não encontraram nada.<br><a href="app.html" style="color:var(--accent)">Ir para Mostrar Tudo</a> para adicionar carros.';
      } else {
          emptyMsg.textContent = 'Nenhum carro encontrado com esses filtros.';
      }
    }
    return;
  }
  if (emptyMsg) emptyMsg.style.display = 'none';

  let lastYear = null;
  dataToRender.forEach((r) => {
    const globalIdx = PAGE_DATA.indexOf(r);
    const dot = getColor(r.color);
    const isNewYear = r.year !== lastYear;
    lastYear = r.year;

    const has = isOwned(r);
    const row = document.createElement('tr');
    if (isNewYear) row.classList.add('year-start');
    if (has) row.classList.add('owned-row');

    const imgCell = r.image
      ? `<div class="img-thumb-wrap" title="Expandir imagem"><img src="${r.image}" alt="${r.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=&quot;img-placeholder&quot;>🚗</div>'"></div>`
      : `<div class="img-thumb-wrap" style="cursor:default" title="Imagem não disponível"><div class="img-placeholder">🚗</div></div>`;

    const qty = getQty(r);
    const repetidos = qty > 1 ? qty - 1 : 0;

    row.innerHTML = `
      <td>${isNewYear ? `<span class="year-pill">${r.year}</span>` : ''}</td>
      <td style="padding:8px 12px">${imgCell}</td>
      <td><div class="car-name" title="${r.name}">${r.name}</div></td>
      <td><span class="series-tag">${r.series}</span></td>
      <td><div class="color-dot"><span class="dot" style="background:${dot};box-shadow:0 0 0 1px rgba(255,255,255,0.15)"></span>${r.color}</div></td>
      <td><span class="part-code">${r.part}</span></td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input class="qty-input" type="number" min="0" max="999" value="${qty}" style="width: 50px;">
          <button class="btn-save" style="display: none; font-size: 11px; padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">Salvar</button>
          <span class="rep-badge" title="Carros Repetidos" style="font-size: 11px; color: ${repetidos > 0 ? '#ea580c' : '#9ca3af'}; font-weight: 600; background: ${repetidos > 0 ? '#ffedd5' : '#f3f4f6'}; padding: 3px 6px; border-radius: 4px; min-width: 22px; text-align: center; border: 1px solid ${repetidos > 0 ? '#fdba74' : '#e5e7eb'}; transition: all 0.2s;">
            +${repetidos}
          </span>
        </div>
      </td>
    `;

    const inputElement = row.querySelector('.qty-input');
    const saveBtn = row.querySelector('.btn-save');
    const repBadge = row.querySelector('.rep-badge');

    inputElement.addEventListener('input', (e) => {
      let newVal = parseInt(e.target.value) || 0;
      if (newVal < 0) { newVal = 0; e.target.value = 0; }
      if (newVal !== getQty(r)) {
        saveBtn.style.display = 'block';
      } else {
        saveBtn.style.display = 'none';
      }
    });

    saveBtn.addEventListener('click', () => {
      let newVal = parseInt(inputElement.value) || 0;
      saveData(r.id, newVal);

      if (newVal > 0) row.classList.add('owned-row');
      else row.classList.remove('owned-row');

      const repCount = newVal > 1 ? newVal - 1 : 0;
      repBadge.textContent = `+${repCount}`;
      if (repCount > 0) {
        repBadge.style.color = '#ea580c';
        repBadge.style.background = '#ffedd5';
        repBadge.style.borderColor = '#fdba74';
      } else {
        repBadge.style.color = '#9ca3af';
        repBadge.style.background = '#f3f4f6';
        repBadge.style.borderColor = '#e5e7eb';
      }
      saveBtn.style.display = 'none';
      updateCounts();
      
      // Se a caixa de verificação estiver ativa ou estiver na página "Minha Coleção" e o utilizador colocar 0, refaz a tabela
      const filterOwnedCheckbox = document.getElementById('filter-owned-only');
      if ((pageType === 'owned' || (filterOwnedCheckbox && filterOwnedCheckbox.checked)) && newVal === 0) {
         render();
      }
    });

    const wrap = row.querySelector('.img-thumb-wrap');
    if (wrap && r.image) {
      wrap.addEventListener('click', () => openLb(globalIdx));
    }

    tbody.appendChild(row);
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

  if(totCountEl) totCountEl.textContent = total;
  if(ownCountEl) ownCountEl.textContent = owned;
  if(misCountEl) misCountEl.textContent = missing;
  if(dupCountEl) dupCountEl.textContent = dups;
}

// ==========================================
// 8. FIREBASE
// ==========================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    sessionUid = user.uid;
    const emailEl = document.getElementById('user-email');
    if(emailEl) emailEl.textContent = user.email;
    await loadCollection();
  } else {
    window.location.href = 'index.html';
  }
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
  if (!sessionUid) return;
  try {
    const dRef = doc(db, 'collections', sessionUid);
    const snap = await getDoc(dRef);
    if (snap.exists()) {
      userCollection = snap.data().items || {};
    } else {
      userCollection = {};
    }
    init();
  } catch (err) {
    console.error("Erro load:", err);
    init();
  }
}

let saveTimeout = null;
async function saveData(carId, qty) {
  userCollection[carId] = qty;

  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (!sessionUid) return;
    try {
      const dRef = doc(db, 'collections', sessionUid);
      await setDoc(dRef, { items: userCollection }, { merge: true });
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
if(lbCloseBtn) lbCloseBtn.addEventListener('click', closeLb);

const lbPrevBtn = document.getElementById('lb-prev');
if(lbPrevBtn) {
  lbPrevBtn.addEventListener('click', () => { if (lbIndex > 0) openLb(lbIndex - 1); });
}

const lbNextBtn = document.getElementById('lb-next');
if(lbNextBtn) {
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
// 10. INICIALIZAÇÃO
// ==========================================
function init() {
  populateFilters();
  updateCounts();
  render();

  const menuBtn = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const closeBtn = document.getElementById('close-sidebar');

  function openMenu() { if(sidebar) sidebar.classList.add('open'); if(overlay) overlay.classList.add('open'); }
  function closeMenu() { if(sidebar) sidebar.classList.remove('open'); if(overlay) overlay.classList.remove('open'); }

  if(menuBtn) menuBtn.addEventListener('click', openMenu);
  if(closeBtn) closeBtn.addEventListener('click', closeMenu);
  if(overlay) overlay.addEventListener('click', closeMenu);

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

  if(searchInput) searchInput.addEventListener('input', () => { currentPage = 1; render(); });
  if(yearInput) yearInput.addEventListener('change', () => { currentPage = 1; render(); });
  if(eraInput) eraInput.addEventListener('change', () => { currentPage = 1; render(); });
  if(seriesInput) seriesInput.addEventListener('change', () => { currentPage = 1; render(); });
  if(filterOwnedCheckbox) filterOwnedCheckbox.addEventListener('change', () => { currentPage = 1; render(); });

  const btnClear = document.getElementById('btn-clear');
  if(btnClear) {
    btnClear.addEventListener('click', () => {
      currentPage = 1;
      if(searchInput) searchInput.value = '';
      if(yearInput) yearInput.value = '';
      if(eraInput) eraInput.value = '';
      if(seriesInput) seriesInput.value = '';
      if(filterOwnedCheckbox) filterOwnedCheckbox.checked = false;
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
}
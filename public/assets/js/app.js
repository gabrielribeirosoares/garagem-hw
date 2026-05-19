import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { RAW } from './data.js';

const idsGerados = new Set();
RAW.forEach((r) => {
  if (!r.id) {
    // Limpa espaços e carateres estranhos
    const cName = (r.name || "").replace(/[^a-zA-Z0-9]/g, "");
    const cColor = (r.color || "").replace(/[^a-zA-Z0-9]/g, "");
    const cPart = (r.part || "").replace(/[^a-zA-Z0-9]/g, "");

    // Cria a base do ID (Ex: hw_1990_bajabug_red)
    let baseId = `hw_${r.year}_${cPart}_${cName}_${cColor}`.toLowerCase();
    let finalId = baseId;
    let counter = 1;

    // Garante que não há IDs duplicados
    while (idsGerados.has(finalId)) {
      finalId = `${baseId}_${counter}`;
      counter++;
    }
    idsGerados.add(finalId);
    r.id = finalId; // Atribui o ID ao carro
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
}

const PAGE_DATA = RAW.filter(r => {
  if (pageType === 'all') return true;
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

// Paginação
let currentPage = 1;
let itemsPerPage = 50;

// Lightbox
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

function getEraLabel(era) {
  return `<span class="era-badge era-${era}">${eraMap[era] || era}</span>`;
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
  years.forEach(y => {
    if (!y) return;
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    selYear.appendChild(opt);
  });

  const series = [...new Set(PAGE_DATA.map(r => r.series))].filter(Boolean).sort();
  const selSeries = document.getElementById('filter-series');
  series.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    selSeries.appendChild(opt);
  });
}

// ==========================================
// 5. OBTENÇÃO DE DADOS FILTRADOS
// ==========================================
function getFilteredData() {
  const sq = document.getElementById('filter-search').value.toLowerCase();
  const sy = document.getElementById('filter-year').value;
  const se = document.getElementById('filter-era').value;
  const ss = document.getElementById('filter-series').value;
  const so = document.getElementById('filter-owned-only').checked;

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
// 6. RENDERIZAÇÃO DA TABELA (COM PAGINAÇÃO)
// ==========================================
function render() {
  const fullData = getFilteredData();
  const tbody = document.getElementById('table-body');

  // -- Lógica de Paginação --
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
        btnPrev.disabled = currentPage === 1;
        btnNext.disabled = currentPage === totalPages;
        btnPrev.style.opacity = btnPrev.disabled ? "0.5" : "1";
        btnNext.style.opacity = btnNext.disabled ? "0.5" : "1";
      }
    } else {
      if (pageIndicator) {
        pageIndicator.textContent = `Página 1 de 1`;
        btnPrev.disabled = true;
        btnNext.disabled = true;
        btnPrev.style.opacity = "0.5";
        btnNext.style.opacity = "0.5";
      }
    }
  }

  tbody.innerHTML = '';
  document.getElementById('visible-count').textContent = dataToRender.length;
  document.getElementById('all-count').textContent = fullData.length;

  if (!dataToRender.length) {
    document.getElementById('empty-msg').style.display = 'block';
    return;
  }
  document.getElementById('empty-msg').style.display = 'none';

  let lastYear = null;
  dataToRender.forEach((r) => {
    // Para manter o Lightbox a funcionar nas páginas seguintes:
    const globalIdx = PAGE_DATA.indexOf(r);

    const era = getEra(r.year);
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

    // Adicionado o botão "Salvar" escondido por padrão
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

    // 1. Mostrar o botão Salvar APENAS se o valor for alterado
    inputElement.addEventListener('input', (e) => {
      let newVal = parseInt(e.target.value) || 0;
      if (newVal < 0) { newVal = 0; e.target.value = 0; }

      // Se o número digitado for diferente do que está guardado, mostra o botão
      if (newVal !== getQty(r)) {
        saveBtn.style.display = 'block';
      } else {
        saveBtn.style.display = 'none'; // Esconde se voltar ao número original
      }
    });

    // 2. Só guarda e atualiza as estatísticas quando clica em "Salvar"
    saveBtn.addEventListener('click', () => {
      let newVal = parseInt(inputElement.value) || 0;

      // Guarda na base de dados
      saveData(r.id, newVal);

      // Atualiza o estilo da linha
      if (newVal > 0) row.classList.add('owned-row');
      else row.classList.remove('owned-row');

      // Atualiza a etiqueta de repetidos
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

      // Esconde o botão Salvar pois já está guardado
      saveBtn.style.display = 'none';

      // Atualiza os contadores no cabeçalho
      updateCounts();
    });

    const wrap = row.querySelector('.img-thumb-wrap');
    if (wrap && r.image) {
      wrap.addEventListener('click', () => openLb(globalIdx));
    }

    tbody.appendChild(row);
  });

  // Guardamos para uso do lightbox e paginação
  window.currentFilteredData = fullData;
}

// ==========================================
// 7. ESTATÍSTICAS E QUANTIDADE
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

  document.getElementById('total-count').textContent = total;
  document.getElementById('owned-count').textContent = owned;
  document.getElementById('missing-count').textContent = missing;
  document.getElementById('dup-count').textContent = dups;
}

// ==========================================
// 8. FIREBASE (AUTH & DATA)
// ==========================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    sessionUid = user.uid;
    // O span #user-email ainda existe na interface
    if(document.getElementById('user-email')) {
      document.getElementById('user-email').textContent = user.email;
    }
    await loadCollection();
  } else {
    window.location.href = 'index.html';
  }
});

// Atualizado: Novo botão de Sair no Menu Hambúrguer
const btnLogoutMenu = document.getElementById('logout-menu');
if (btnLogoutMenu) {
  btnLogoutMenu.addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = "index.html";
    } catch (error) {
      console.error("Erro ao sair da conta:", error);
      alert("Erro ao sair da conta. Tente novamente.");
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
    console.error("Erro Firebase load:", err);
    init();
  }
}

// Otimização: Debounce para evitar excesso de escritas no Firebase
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
      console.error("Erro Firebase save:", e);
    }
  }, 1000); // Aguarda 1 segundo após a última digitação
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

document.getElementById('lb-close-btn').addEventListener('click', closeLb);

document.getElementById('lb-prev').addEventListener('click', () => {
  if (lbIndex > 0) openLb(lbIndex - 1);
});

document.getElementById('lb-next').addEventListener('click', () => {
  if (lbIndex < PAGE_DATA.length - 1) openLb(lbIndex + 1);
});

document.addEventListener('keydown', (e) => {
  if (document.getElementById('lightbox').style.display === 'flex') {
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft' && lbIndex > 0) openLb(lbIndex - 1);
    if (e.key === 'ArrowRight' && lbIndex < PAGE_DATA.length - 1) openLb(lbIndex + 1);
  }
});

// ==========================================
// 10. INICIALIZAÇÃO E EVENTOS GERAIS
// ==========================================
function init() {
  populateFilters();
  updateCounts();
  render();

  // Sidebar Mobile
  const menuBtn = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const closeBtn = document.getElementById('close-sidebar');

  function openMenu() { sidebar.classList.add('open'); overlay.classList.add('open'); }
  function closeMenu() { sidebar.classList.remove('open'); overlay.classList.remove('open'); }

  menuBtn.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', closeMenu);
  overlay.addEventListener('click', closeMenu);

  // Ordenação nas tabelas
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
      currentPage = 1; // Ao reordenar, volta à pág. 1
      render();
    });
  });

  // Filtros Globais
  document.getElementById('filter-search').addEventListener('input', () => { currentPage = 1; render(); });
  document.getElementById('filter-year').addEventListener('change', () => { currentPage = 1; render(); });
  document.getElementById('filter-era').addEventListener('change', () => { currentPage = 1; render(); });
  document.getElementById('filter-series').addEventListener('change', () => { currentPage = 1; render(); });
  document.getElementById('filter-owned-only').addEventListener('change', () => { currentPage = 1; render(); });

  document.getElementById('btn-clear').addEventListener('click', () => {
    currentPage = 1;
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-year').value = '';
    document.getElementById('filter-era').value = '';
    document.getElementById('filter-series').value = '';
    document.getElementById('filter-owned-only').checked = false;
    render();
  });

  // Eventos de Paginação
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
// assets/js/app.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { RAW } from './data.js';

const COLOR_MAP = {
  'spectraflame green': '#2e7d32', 'spectraflame black': '#212121', 'spectraflame yellow': '#f9a825',
  'spectraflame red': '#c62828', 'spectraflame blue': '#1565c0', 'spectraflame orange': '#e65100',
  'spectraflame purple': '#6a1b9a', 'spectraflame aqua': '#00838f', 'spectraflame maroon': '#880e4f',
  'spectraflame brown': '#5d4037', 'spectraflame gold': '#f57f17', 'spectraflame smoke': '#607d8b',
  'spectraflame gulf blue': '#0277bd', 'spectraflame pink': '#e91e8c', 'spectraflame silver': '#9e9e9e',
  'spectraflame copper': '#bf360c', 'spectraflame dark blue': '#0d47a1', 'spectraflame light blue': '#4fc3f7',
  'spectraflame lime': '#558b2f', 'red': '#e53935', 'blue': '#1e88e5', 'black': '#424242', 'yellow': '#f9a825',
  'orange': '#ef6c00', 'green': '#43a047', 'white': '#eeeeee', 'purple': '#8e24aa', 'pink': '#e91e63',
  'gray': '#757575', 'grey': '#757575', 'gold': '#ffa000', 'silver': '#bdbdbd', 'brown': '#6d4c41'
};

function getColor(c) {
  const k = (c || '').toLowerCase();
  for (const [key, val] of Object.entries(COLOR_MAP)) {
    if (k.includes(key)) return val;
  }
  return '#555';
}

function getEra(year) {
  const y = parseInt(year);
  if (y <= 2011) return 'classic';
  if (y === 2012) return 'secret';
  return 'hidden';
}

function getEraLabel(era) {
  if (era === 'classic') return '<span class="era-badge era-classic">Clássica</span>';
  if (era === 'secret') return '<span class="era-badge era-secret">Super Secret</span>';
  return '<span class="era-badge era-hidden">Hidden</span>';
}

let sessionUid = null;
let owned = {}; 
let sortCol = 'year';
let sortAsc = true;
let lbCurrentIdx = -1;
let lbFilteredData = [];

async function loadCollection() {
  try {
    const userRef = doc(db, "users", sessionUid);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      owned = docSnap.data().owned || {};
    } else {
      owned = {};
    }
  } catch (error) {
    console.error("Erro ao carregar a coleção:", error);
  }
}

async function save() {
  if (!sessionUid) return;
  try {
    await setDoc(doc(db, "users", sessionUid), { owned: owned }, { merge: true });
  } catch (error) {
    console.error("Erro ao gravar:", error);
  }
}

function idOf(r) { return r.part || `${r.year}-${r.name}`; }

// Lógica de leitura de quantidade
function getQty(r) {
  const val = owned[idOf(r)];
  if (val === true) return 1; 
  return parseInt(val) || 0;
}

function isOwned(r) { return getQty(r) > 0; }

onAuthStateChanged(auth, async (user) => {
  if (user) {
    sessionUid = user.uid;
    document.getElementById('user-email').textContent = user.email;
    await loadCollection();
    initFilters();
    updateStats();
    render(); 
  } else {
    location.href = 'index.html';
  }
});

document.getElementById('logout').addEventListener('click', () => signOut(auth));

function updateStats() {
  const total = RAW.length;
  let ownedUnique = 0;
  let duplicatesCount = 0;

  RAW.forEach(r => {
    const qty = getQty(r);
    if (qty > 0) {
      ownedUnique++;
      if (qty > 1) {
        duplicatesCount += (qty - 1);
      }
    }
  });

  document.getElementById('total-count').textContent = total;
  document.getElementById('all-count').textContent = total;
  document.getElementById('owned-count').textContent = ownedUnique;
  document.getElementById('missing-count').textContent = total - ownedUnique;
  
  const dupEl = document.getElementById('dup-count');
  if (dupEl) dupEl.textContent = duplicatesCount;
}

function initFilters() {
  const ySel = document.getElementById('filter-year');
  [...new Set(RAW.map(r => r.year))].sort((a, b) => b - a).forEach(y => {
    const o = document.createElement('option'); o.value = y; o.textContent = y; ySel.appendChild(o);
  });

  // CORREÇÃO: Agrupa as coleções ignorando maiúsculas/minúsculas
  const sSel = document.getElementById('filter-series');
  const seriesMap = new Map();
  RAW.forEach(r => {
    if (r.series) {
      const name = r.series.trim();
      const key = name.toLowerCase();
      // Guarda apenas a primeira versão que encontrar para exibir na lista
      if (!seriesMap.has(key)) {
        seriesMap.set(key, name); 
      }
    }
  });

  // Gera a lista em ordem alfabética
  [...seriesMap.values()].sort((a, b) => a.localeCompare(b)).forEach(s => {
    const o = document.createElement('option'); 
    o.value = s.toLowerCase(); // O valor de busca (o que o sistema lê) será sempre minúsculo
    o.textContent = s; // O texto visível fica formatado
    sSel.appendChild(o);
  });

  document.getElementById('filter-year').addEventListener('change', render);
  document.getElementById('filter-era').addEventListener('change', render);
  document.getElementById('filter-series').addEventListener('change', render);
  document.getElementById('filter-search').addEventListener('input', render);
  document.getElementById('filter-owned-only').addEventListener('change', render);
  
  document.getElementById('btn-clear').addEventListener('click', () => {
    document.getElementById('filter-year').value = '';
    document.getElementById('filter-era').value = '';
    document.getElementById('filter-series').value = '';
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-owned-only').checked = false;
    render();
  });

  document.querySelectorAll('th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) sortAsc = !sortAsc;
      else { sortCol = col; sortAsc = true; }
      document.querySelectorAll('th').forEach(t => {
        t.classList.remove('sorted');
        const icon = t.querySelector('.sort-icon');
        if (icon) icon.textContent = '↕';
      });
      th.classList.add('sorted');
      th.querySelector('.sort-icon').textContent = sortAsc ? '↓' : '↑';
      render();
    });
  });
}

function getFilteredData() {
  const fy = document.getElementById('filter-year').value;
  const fe = document.getElementById('filter-era').value;
  const fs = document.getElementById('filter-series').value; // Agora já vem sempre em minúsculo
  const fq = document.getElementById('filter-search').value.toLowerCase().trim();
  const ownedOnly = document.getElementById('filter-owned-only').checked;

  let data = RAW.filter(r => {
    if (fy && String(r.year) !== fy) return false;
    if (fe && getEra(r.year) !== fe) return false;
    
    // CORREÇÃO: Converte o nome da série do carro para minúsculo antes de comparar
    if (fs && (r.series || '').toLowerCase().trim() !== fs) return false;
    
    if (fq && !r.name.toLowerCase().includes(fq) && !(r.series || '').toLowerCase().includes(fq)) return false;
    if (ownedOnly && !isOwned(r)) return false;
    return true;
  });

  data.sort((a, b) => {
    let va = sortCol === 'year' ? a.year : (a[sortCol] || '');
    let vb = sortCol === 'year' ? b.year : (b[sortCol] || '');
    if (sortCol === 'hw') { va = parseInt(a.hw) || 0; vb = parseInt(b.hw) || 0; }
    if (typeof va === 'number') return sortAsc ? va - vb : vb - va;
    return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });
  return data;
}
function render() {
  const data = getFilteredData();
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  document.getElementById('visible-count').textContent = data.length;

  if (!data.length) {
    document.getElementById('empty-msg').style.display = 'block';
    return;
  }
  document.getElementById('empty-msg').style.display = 'none';

  let lastYear = null;
  data.forEach(r => {
    const era = getEra(r.year);
    const dot = getColor(r.color);
    const isNewYear = r.year !== lastYear;
    lastYear = r.year;

    const globalIdx = RAW.indexOf(r);
    const has = isOwned(r);
    const row = document.createElement('tr');
    if (isNewYear) row.classList.add('year-start');
    if (has) row.classList.add('owned-row');

    const imgCell = r.image 
      ? `<div class="img-thumb-wrap" title="Expandir imagem"><img src="${r.image}" alt="${r.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=&quot;img-placeholder&quot;>🚗</div>'"></div>`
      : `<div class="img-thumb-wrap" style="cursor:default" title="Imagem não disponível"><div class="img-placeholder">🚗</div></div>`;

    row.innerHTML = `
      <td>${isNewYear ? `<span class="year-pill">${r.year}</span>` : ''}</td>
      <td>${getEraLabel(era)}</td>
      <td style="padding:8px 12px">${imgCell}</td>
      <td><div class="car-name" title="${r.name}">${r.name}</div></td>
      <td><span class="series-tag">${r.series}</span></td>
      <td><div class="color-dot"><span class="dot" style="background:${dot};box-shadow:0 0 0 1px rgba(255,255,255,0.15)"></span>${r.color}</div></td>
      <td><span class="part-code">${r.part}</span></td>
      <td><span class="hw-num">${r.hw}</span></td>
      <td><span class="case-badge">${r.cas}</span></td>
      
      <td><input class="qty-input" type="number" min="0" max="999" value="${getQty(r)}"></td>
    `;
    
    // Evento para gravar a quantidade assim que ela muda
    row.querySelector('.qty-input').addEventListener('input', (e) => {
      let newVal = parseInt(e.target.value) || 0;
      if (newVal < 0) newVal = 0;
      
      owned[idOf(r)] = newVal;
      save(); 
      updateStats(); 
      
      if (newVal > 0) row.classList.add('owned-row');
      else row.classList.remove('owned-row');
    });

    const thumb = row.querySelector('.img-thumb-wrap');
    if (r.image) thumb.addEventListener('click', () => openLightbox(globalIdx));

    tbody.appendChild(row);
  });
}

function openLightbox(idx) {
  lbFilteredData = getFilteredData().map(item => RAW.indexOf(item));
  showLightboxCar(idx);
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function showLightboxCar(idx) {
  lbCurrentIdx = idx;
  const car = RAW[idx];
  const era = getEra(car.year);
  const eraLabels = { classic: 'Clássica (2007–2011)', secret: 'Super Secret (2012)', hidden: 'Hidden / Moderna' };

  document.getElementById('lb-title').textContent = car.name;
  document.getElementById('lb-meta').innerHTML = `
    <div class="lb-tag"><div class="lb-tag-label">Ano</div><div class="lb-tag-val yellow">${car.year}</div></div>
    <div class="lb-tag"><div class="lb-tag-label">Coleção</div><div class="lb-tag-val">${car.series}</div></div>
    <div class="lb-tag"><div class="lb-tag-label">Cor</div><div class="lb-tag-val">${car.color}</div></div>
    <div class="lb-tag"><div class="lb-tag-label">Código</div><div class="lb-tag-val red">${car.part}</div></div>
    <div class="lb-tag"><div class="lb-tag-label">Case</div><div class="lb-tag-val yellow">${car.cas}</div></div>
    <div class="lb-tag"><div class="lb-tag-label">Era</div><div class="lb-tag-val">${eraLabels[era]}</div></div>
  `;

  const pos = lbFilteredData.indexOf(idx);
  document.getElementById('lb-prev').disabled = pos <= 0;
  document.getElementById('lb-next').disabled = pos >= lbFilteredData.length - 1;
  document.getElementById('lb-counter').textContent = pos >= 0 ? `${pos + 1} / ${lbFilteredData.length}` : '';
  document.getElementById('lb-img').src = car.image || '';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('lb-close-btn').addEventListener('click', closeLightbox);
document.getElementById('lb-prev').addEventListener('click', () => {
  const pos = lbFilteredData.indexOf(lbCurrentIdx);
  if (pos - 1 >= 0) showLightboxCar(lbFilteredData[pos - 1]);
});
document.getElementById('lb-next').addEventListener('click', () => {
  const pos = lbFilteredData.indexOf(lbCurrentIdx);
  if (pos + 1 < lbFilteredData.length) showLightboxCar(lbFilteredData[pos + 1]);
});

document.addEventListener('keydown', e => {
  if (!document.getElementById('lightbox').classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') document.getElementById('lb-prev').click();
  if (e.key === 'ArrowRight') document.getElementById('lb-next').click();
});
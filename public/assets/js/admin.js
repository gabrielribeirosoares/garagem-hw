import { auth, db, firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { onAuthStateChanged, getAuth as getAuthSecondary, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { RAW } from './data.js';

const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuthSecondary(secondaryApp);

const usersTbody = document.getElementById('users-tbody');
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-user-form');

const editUid = document.getElementById('edit-uid');
const editName = document.getElementById('edit-name');
const editPhone = document.getElementById('edit-phone');
const editRole = document.getElementById('edit-role');
const btnCloseModal = document.getElementById('btn-close-modal');

let allUsersCache = [];
let currentTargetUid = null;

const idsGerados = new Set();
RAW.forEach((r) => {
  if (!r.id) {
    const cName = (r.name || "").replace(/[^a-zA-Z0-9]/g, "");
    const cColor = (r.color || "").replace(/[^a-zA-Z0-9]/g, "");
    const cPart = (r.part || "").replace(/[^a-zA-Z0-9]/g, "");
    let baseId = `hw_${r.year}_${cPart}_${cName}_${cColor}`.toLowerCase();
    let finalId = baseId;
    let counter = 1;
    while (idsGerados.has(finalId)) { finalId = `${baseId}_${counter}`; counter++; }
    idsGerados.add(finalId);
    r.id = finalId;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const role = userDoc.exists() ? userDoc.data().role : 'user';

      if (role === 'admin' || role === 'gerente') {
        loadUsersList();
      } else {
        window.location.href = 'app.html';
      }
    } catch (err) {
      console.error("Erro na validação de acesso:", err);
      window.location.href = 'app.html';
    }
  } else {
    window.location.href = 'index.html';
  }
});

async function loadUsersList() {
  try {
    if (!usersTbody) return;

    const myUid = auth.currentUser.uid;
    const myDoc = await getDoc(doc(db, 'users', myUid));
    const myRole = myDoc.exists() ? myDoc.data().role : 'user';
    const myLojaId = myDoc.exists() ? (myDoc.data().lojaId || '') : '';

    window.currentUserRole = myRole;
    window.minhaLojaId = myLojaId; 
    const btnMyRewards = document.getElementById('btn-my-store-rewards');
    if (btnMyRewards && (myRole === 'admin' || myRole === 'gerente')) {
        btnMyRewards.style.display = 'inline-block';
    }

    const querySnapshot = await getDocs(collection(db, 'users'));

    usersTbody.innerHTML = '';
    allUsersCache = [];

    querySnapshot.forEach((docSnap) => {
      const userData = docSnap.data();
      userData.uid = docSnap.id;

      if (myRole === 'gerente') {
        if (userData.role !== 'cliente' || userData.lojaId !== myLojaId) {
          return;
        }
      }

      allUsersCache.push(userData);

      let roleName = 'Usuário';
      let roleColor = '#64748b';
      let btnPremios = '';

      if (userData.role === 'admin') {
        roleName = 'Admin';
        roleColor = '#f59e0b';
      } else if (userData.role === 'gerente') {
        roleName = 'Gerente';
        roleColor = '#10b981';

        if (myRole === 'admin' && userData.lojaId) {
          btnPremios = `<button class="btn-manage-rewards" data-lojaid="${userData.lojaId}" style="background: #8b5cf6; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 8px;">🎁 Prêmios</button>`;
        }
      } else if (userData.role === 'cliente') {
        roleName = 'Cliente VIP';
        roleColor = '#3b82f6';
      }

      const phoneTxt = (userData.phone && userData.phone !== '(00) 00000-0000') ? userData.phone : 'Sem Telefone';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Nome">${userData.name || 'Sem Nome'}</td>
        <td data-label="E-mail">${userData.email || 'Sem E-mail'}</td>
        <td data-label="Telefone">${phoneTxt}</td>
        <td data-label="Nascimento">${userData.birthdate || 'Não informada'}</td>
        <td data-label="Cargo"><strong style="color: ${roleColor}">${roleName}</strong></td>
        <td data-label="Ações">
          ${btnPremios} <button class="btn-manage-rifa" data-id="${userData.uid}" data-name="${userData.name || 'Usuário'}" style="background: rgba(250, 204, 21, 0.15); color: var(--yellow); border: 1px solid var(--yellow); padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 8px;">🎟️ Rifas</button>
          <button class="btn-manage-cars" data-id="${userData.uid}" data-name="${userData.name || 'Usuário'}" style="background: rgba(34, 197, 94, 0.2); color: var(--green); border: 1px solid var(--green); padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 8px;">🚗 Garagem</button>
          <button class="btn-edit" data-id="${userData.uid}">Editar</button>
          <button class="btn-delete" data-id="${userData.uid}" data-name="${userData.name || 'Este usuário'}">Excluir</button>
        </td>
      `;
      usersTbody.appendChild(tr);
    });

  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    if (usersTbody) usersTbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Erro ao carregar lista de usuários.</td></tr>`;
  }
}

if (usersTbody) {
  usersTbody.addEventListener('click', async (e) => {

    if (e.target.classList.contains('btn-edit')) {
      const uidToEdit = e.target.getAttribute('data-id');
      openEditModal(uidToEdit);
    }

    if (e.target.classList.contains('btn-delete')) {
      const uidToDelete = e.target.getAttribute('data-id');
      const userName = e.target.getAttribute('data-name');

      const confirmacao = confirm(`ATENÇÃO: Tem certeza absoluta que deseja excluir permanentemente o usuário "${userName}"? \n\nIsso apagará o perfil dele e TODOS os carrinhos da coleção dele do banco de dados!`);

      if (confirmacao) {
        const botaoOriginalText = e.target.textContent;
        e.target.textContent = "Excluindo...";
        e.target.disabled = true;

        try {
          const configRef = doc(db, 'config', 'app');
          await updateDoc(configRef, { cadastrados: increment(-1) });

          await deleteDoc(doc(db, 'collections', uidToDelete));
          await deleteDoc(doc(db, 'users', uidToDelete));

          alert('Usuário e dados de coleção deletados com sucesso!');
          loadUsersList();
        } catch (error) {
          console.error("Erro ao deletar usuário:", error);
          alert('Erro ao excluir usuário: ' + error.message);
          e.target.textContent = botaoOriginalText;
          e.target.disabled = false;
        }
      }
    }
  });
}

function openEditModal(uid) {
  const userSelected = allUsersCache.find(u => u.uid === uid);
  if (!userSelected) return;

  const editLojaId = document.getElementById('edit-lojaId');

  if (editUid && editName && editPhone && editRole) {
    editUid.value = userSelected.uid;
    editName.value = userSelected.name || '';
    editPhone.value = (userSelected.phone && userSelected.phone !== '(00) 00000-0000') ? userSelected.phone : '';
    editRole.value = userSelected.role || 'user';
    if (editLojaId) editLojaId.value = userSelected.lojaId || '';

    if (window.currentUserRole === 'gerente') {
      editRole.disabled = true;
      editRole.style.opacity = '0.5';
      if (editLojaId) {
        editLojaId.disabled = true;
        editLojaId.style.opacity = '0.5';
      }
    } else {
      editRole.disabled = false;
      editRole.style.opacity = '1';
      if (editLojaId) {
        editLojaId.disabled = false;
        editLojaId.style.opacity = '1';
      }
    }
  }

  if (editModal) editModal.style.display = 'flex';
}

if (btnCloseModal) {
  btnCloseModal.addEventListener('click', () => {
    if (editModal) editModal.style.display = 'none';
  });
}

if (editForm) {
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const uid = editUid.value;
    const editLojaId = document.getElementById('edit-lojaId');

    const updatedData = {
      name: editName.value.trim(),
      phone: editPhone.value.trim(),
      role: editRole.value,
      lojaId: editLojaId ? editLojaId.value.trim() : ''
    };

    try {
      await setDoc(doc(db, 'users', uid), updatedData, { merge: true });
      if (editModal) editModal.style.display = 'none';
      alert('Usuário atualizado com sucesso!');
      loadUsersList();
    } catch (error) {
      alert('Erro ao salvar: ' + error.message);
    }
  });
}

if (editPhone) {
  editPhone.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');

    if (value.length === 0) {
      e.target.value = '';
      return;
    }

    if (value.length > 11) value = value.slice(0, 11);

    if (value.length > 6) {
      e.target.value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
      e.target.value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else {
      e.target.value = value;
    }
  });
}

window.validarCupom = async function () {
  const inputElement = document.getElementById('cupom-input');
  const resultDiv = document.getElementById('cupom-result');

  if (!inputElement || !resultDiv) return;
  const codigoInput = inputElement.value.toUpperCase().trim();

  if (!codigoInput) {
    resultDiv.innerHTML = '<p style="color: var(--red);">Por favor, digite um código de cupom.</p>';
    return;
  }

  resultDiv.innerHTML = '<p style="color: var(--muted);">⏳ Buscando no banco de dados...</p>';

  try {
    const querySnapshot = await getDocs(collection(db, "collections"));
    let foundDocId = null;
    let foundData = null;
    let couponIndex = -1;

    querySnapshot.forEach((documento) => {
      const data = documento.data();
      if (data.rewards) {
        const idx = data.rewards.findIndex(r => r.codigo === codigoInput);
        if (idx !== -1) {
          foundDocId = documento.id;
          foundData = data;
          couponIndex = idx;
        }
      }
    });

    if (!foundDocId) {
      resultDiv.innerHTML = `
        <div style="background: rgba(232, 0, 30, 0.1); border: 1px solid var(--red); padding: 16px; border-radius: 8px; margin-top: 20px;">
            <h3 style="color: var(--red); margin-bottom: 4px; font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 1px;">❌ Cupom Inválido</h3>
            <p style="font-size: 14px; color: #ccc;">Este código não foi encontrado no sistema.</p>
        </div>
      `;
      return;
    }

    const cupom = foundData.rewards[couponIndex];

    if (cupom.status === 'Utilizado') {
      resultDiv.innerHTML = `
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid #555; padding: 16px; border-radius: 8px; margin-top: 20px;">
            <h3 style="color: #ccc; margin-bottom: 4px; font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 1px;">⚠️ Cupom já utilizado</h3>
            <p style="font-size: 14px; color: #aaa;">Prêmio: <b>${cupom.titulo}</b></p>
            <p style="font-size: 14px; color: #aaa;">Data do resgate: ${cupom.data}</p>
            <p style="font-size: 12px; color: var(--red); margin-top: 10px;">Atenção: Não libere o prêmio. Este código já teve baixa no sistema.</p>
        </div>
      `;
    } else {
      resultDiv.innerHTML = `
        <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid var(--green); padding: 16px; border-radius: 8px; margin-top: 20px;">
            <h3 style="color: var(--green); margin-bottom: 4px; font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 1px;">✅ Cupom Válido e Disponível!</h3>
            <p style="font-size: 14px; color: #fff;">Prêmio: <b>${cupom.titulo}</b></p>
            <p style="font-size: 14px; color: #ccc; margin-bottom: 15px;">Data do resgate: ${cupom.data}</p>
            <button onclick="marcarComoUtilizado('${foundDocId}', ${couponIndex})" style="background: var(--green); color: black; font-family: 'Bebas Neue', sans-serif; font-size: 20px; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; width: 100%;">
                Dar Baixa (Marcar como Utilizado)
            </button>
        </div>
      `;
      window.currentAdminData = foundData;
    }
  } catch (error) {
    console.error("Erro ao validar:", error);
    resultDiv.innerHTML = '<p style="color: var(--red);">Erro de conexão com o Firebase.</p>';
  }
};

window.marcarComoUtilizado = async function (docId, index) {
  const data = window.currentAdminData;
  data.rewards[index].status = 'Utilizado';

  try {
    await setDoc(doc(db, 'collections', docId), { rewards: data.rewards }, { merge: true });
    document.getElementById('cupom-result').innerHTML = `
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid #555; padding: 16px; border-radius: 8px; text-align: center; margin-top: 20px;">
            <h3 style="color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 1px;">BAIXA CONCLUÍDA!</h3>
            <p style="font-size: 14px; color: var(--green);">O cupom foi invalidado com sucesso. Pode enviar o prêmio!</p>
        </div>
    `;
    document.getElementById('cupom-input').value = '';
  } catch (e) {
    console.error("Erro ao atualizar o cupom:", e);
    alert('Erro ao comunicar com o servidor. Tente novamente.');
  }
};

if (usersTbody) {
  usersTbody.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-manage-rifa')) {
      currentTargetUid = e.target.getAttribute('data-id');
      const nameEl = document.getElementById('rifa-user-name');
      if (nameEl) nameEl.textContent = e.target.getAttribute('data-name');

      const qtyInput = document.getElementById('rifa-qty-input');
      if (qtyInput) qtyInput.value = 1;

      const modal = document.getElementById('rifa-modal');
      if (modal) modal.style.display = 'flex';
    }
  });
}

const btnSaveRifa = document.getElementById('btn-save-rifa');
if (btnSaveRifa) {
  btnSaveRifa.addEventListener('click', async () => {
    if (!currentTargetUid) return;
    const qty = parseInt(document.getElementById('rifa-qty-input').value) || 0;
    const pts = parseInt(document.getElementById('rifa-points-per-num').value) || 0;

    if (qty <= 0 || pts <= 0) return;

    btnSaveRifa.textContent = "Salvando...";
    btnSaveRifa.disabled = true;

    try {
      const uRef = doc(db, 'collections', currentTargetUid);
      const snap = await getDoc(uRef);
      const currentData = snap.exists() ? snap.data() : { history: [] };
      const currentPts = currentData.points || 0;
      const history = currentData.history || [];

      const ganhou = qty * pts;
      const newTotal = currentPts + ganhou;

      history.unshift({
        date: new Date().toLocaleDateString('pt-BR'),
        desc: "Lançamento de Rifa (Painel)",
        amount: ganhou,
        type: "earning"
      });

      await setDoc(uRef, { points: newTotal, history: history }, { merge: true });
      alert(`+${ganhou} RPMs creditados na conta!`);

      document.getElementById('rifa-modal').style.display = 'none';
      btnSaveRifa.textContent = "🪙 Creditar Pontos";
      btnSaveRifa.disabled = false;
    } catch (error) {
      alert("Erro ao creditar pontos.");
      btnSaveRifa.textContent = "🪙 Creditar Pontos";
      btnSaveRifa.disabled = false;
    }
  });
}

const carDatalist = document.getElementById('car-datalist');
if (carDatalist) {
  let options = '';
  RAW.forEach(car => {
    options += `<option value="${car.year} | ${car.name} | ${car.series} | ${car.color} [ID:${car.id}]"></option>`;
  });
  carDatalist.innerHTML = options;
}

if (usersTbody) {
  usersTbody.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-manage-cars')) {
      currentTargetUid = e.target.getAttribute('data-id');
      
      const carUserEl = document.getElementById('manage-user-name');
      if (carUserEl) carUserEl.textContent = e.target.getAttribute('data-name');
      
      const searchInput = document.getElementById('car-search-input');
      if(searchInput) searchInput.value = '';
      
      const qtyInput = document.getElementById('car-qty-input');
      if (qtyInput) qtyInput.value = 1;
      
      const carsModal = document.getElementById('cars-modal');
      if (carsModal) carsModal.style.display = 'flex';
    }
  });
}

const PONTOS_POR_CARRO = 100;

const btnSaveCar = document.getElementById('btn-save-car');
if (btnSaveCar) {
  btnSaveCar.addEventListener('click', async () => {
    if (!currentTargetUid) return;

    const searchInput = document.getElementById('car-search-input').value;
    const qtyInput = parseInt(document.getElementById('car-qty-input').value) || 0;

    const match = searchInput.match(/\[ID:(.*?)\]/);
    if (!match) {
      alert("Por favor, selecione um carro válido da lista.");
      return;
    }

    const carId = match[1];
    btnSaveCar.textContent = "Salvando...";

    try {
      const dRef = doc(db, 'collections', currentTargetUid);
      const snap = await getDoc(dRef);

      let userColData = snap.exists() ? snap.data().items || {} : {};
      let pontosAtuais = snap.exists() ? snap.data().points || 0 : 0;
      let history = snap.exists() ? snap.data().history || [] : [];

      const qtdAntiga = userColData[carId] || 0;
      const uRef = doc(db, 'users', currentTargetUid);
      const uSnap = await getDoc(uRef);
      const userRole = uSnap.exists() ? uSnap.data().role : 'user';

      userColData[carId] = qtyInput;
      let novosPontos = pontosAtuais;

      if (userRole === 'cliente' && qtyInput > qtdAntiga) {
        const diferenca = qtyInput - qtdAntiga;
        const ptsGanhos = diferenca * PONTOS_POR_CARRO;
        novosPontos += ptsGanhos;

        history.unshift({
          date: new Date().toLocaleDateString('pt-BR'),
          desc: "Adição de Carros (Painel)",
          amount: ptsGanhos,
          type: "earning"
        });

        await setDoc(dRef, { items: userColData, points: novosPontos, history: history }, { merge: true });
        alert(`✅ Sucesso! Carro adicionado e +${ptsGanhos} RPMs creditados na conta do Cliente VIP!`);
      } else {
        await setDoc(dRef, { items: userColData, points: novosPontos }, { merge: true });
        alert("✅ Garagem atualizada com sucesso! (Nenhum ponto foi gerado pois o perfil é Usuário Comum ou Qtd não aumentou).");
      }

      document.getElementById('car-search-input').value = '';
      btnSaveCar.textContent = "➕ Adicionar";

    } catch (error) {
      console.error("Erro ao salvar carro:", error);
      alert("Erro ao adicionar o carro. Verifique sua conexão.");
      btnSaveCar.textContent = "➕ Adicionar";
    }
  });
}

let lojaIdParaEditar = '';

if (usersTbody) {
  usersTbody.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-manage-rewards')) {
      lojaIdParaEditar = e.target.getAttribute('data-lojaid');
      
      const lojaNomeEl = document.getElementById('loja-alvo-nome');
      if (lojaNomeEl) lojaNomeEl.textContent = lojaIdParaEditar;
      
      const lojaModal = document.getElementById('loja-modal');
      if (lojaModal) lojaModal.style.display = 'flex';
      
      await renderAdminRewards();
    }
  });
}

async function renderAdminRewards() {
  const listEl = document.getElementById('recompensas-list');
  if (!listEl) return;

  listEl.innerHTML = '<p style="color: #fff; text-align: center;">Carregando prêmios...</p>';

  try {
    const snap = await getDoc(doc(db, 'lojas', lojaIdParaEditar));
    const recompensas = snap.exists() ? (snap.data().recompensas || []) : [];

    if (recompensas.length === 0) {
      listEl.innerHTML = '<p style="color: #9ca3af; text-align: center; font-size: 13px;">Nenhum prêmio nesta loja.</p>';
      return;
    }

    listEl.innerHTML = recompensas.map((r, index) => `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 10px; margin-bottom: 8px; border-radius: 4px; border: 1px solid #334155;">
        <div>
          <strong style="color: #fff;">${r.icone} ${r.titulo}</strong>
          <div style="color: var(--yellow); font-size: 12px;">🪙 ${r.custo} RPMs</div>
        </div>
        <button onclick="deleteReward(${index})" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer; font-size: 11px;">Excluir</button>
      </div>
    `).join('');
  } catch (e) {
    console.error("Erro ao renderizar prêmios:", e);
    listEl.innerHTML = '<p style="color: #ef4444;">Erro ao carregar.</p>';
  }
}

document.getElementById('btn-add-rew')?.addEventListener('click', async () => {
  const icone = document.getElementById('rew-icone').value || '🎁';
  const titulo = document.getElementById('rew-titulo').value;
  const desc = document.getElementById('rew-desc').value;
  const custo = parseInt(document.getElementById('rew-custo').value);

  if (!titulo || !custo) return alert('Preencha o título e o custo do prêmio!');

  document.getElementById('btn-add-rew').textContent = 'Salvando...';

  try {
    const ref = doc(db, 'lojas', lojaIdParaEditar);
    const snap = await getDoc(ref);
    const recompensas = snap.exists() ? (snap.data().recompensas || []) : [];

    recompensas.push({
      id: 'rew_' + Date.now(),
      icone, titulo, desc, custo
    });

    await setDoc(ref, { recompensas }, { merge: true });

    document.getElementById('rew-icone').value = '';
    document.getElementById('rew-titulo').value = '';
    document.getElementById('rew-desc').value = '';
    document.getElementById('rew-custo').value = '';

    await renderAdminRewards();
  } catch (e) {
    alert('Erro ao salvar prêmio.');
  }
  document.getElementById('btn-add-rew').textContent = '➕ Adicionar à Loja';
});

window.deleteReward = async function (index) {
  if (!confirm("Remover este prêmio desta loja?")) return;
  try {
    const ref = doc(db, 'lojas', lojaIdParaEditar);
    const snap = await getDoc(ref);
    let recompensas = snap.data().recompensas;
    recompensas.splice(index, 1);
    await setDoc(ref, { recompensas }, { merge: true });
    await renderAdminRewards();
  } catch (e) {
    alert("Erro ao excluir.");
  }
};


const createModal = document.getElementById('create-modal');
const createForm = document.getElementById('create-user-form');
const createPhone = document.getElementById('create-phone');

const btnNewClient = document.getElementById('btn-new-client');
const modalNewClient = document.getElementById('new-client-modal');
const btnSaveNewClient = document.getElementById('btn-save-new-client');

if (createPhone) {
  createPhone.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length === 0) { e.target.value = ''; return; }
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 6) { e.target.value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 2) { e.target.value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else { e.target.value = value; }
  });
}

if (btnNewClient && modalNewClient) {
    btnNewClient.addEventListener('click', () => {
        document.getElementById('new-client-name').value = '';
        document.getElementById('new-client-email').value = '';
        document.getElementById('new-client-password').value = '';
        modalNewClient.style.display = 'flex';
    });
}

// Salva o usuário no Firebase
if (btnSaveNewClient) {
    btnSaveNewClient.addEventListener('click', async () => {
        const name = document.getElementById('new-client-name').value.trim();
        const email = document.getElementById('new-client-email').value.trim();
        const pass = document.getElementById('new-client-password').value;

        if (!name || !email || !pass) {
            alert("Por favor, preencha todos os campos (Nome, E-mail e Senha)!");
            return;
        }

        const originalText = btnSaveNewClient.textContent;
        btnSaveNewClient.textContent = "Criando Conta...";
        btnSaveNewClient.disabled = true;

        try {
            // Cria a conta do usuário no Auth secundário
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
            const newUid = userCredential.user.uid;

            await signOut(secondaryAuth);

            // Descobre qual é a loja do Admin logado
            const myDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const targetLojaId = myDoc.exists() ? (myDoc.data().lojaId || '') : '';

            // Salva o perfil do Cliente atrelado à loja do Admin
            await setDoc(doc(db, 'users', newUid), {
                name: name,
                email: email,
                phone: '', // Pode ser editado depois pelo Admin
                role: 'cliente',
                lojaId: targetLojaId,
                createdAt: new Date().toLocaleDateString('pt-BR')
            });

            // Cria a Garagem vazia para o Cliente
            await setDoc(doc(db, 'collections', newUid), {
                items: {},
                points: 0,
                history: [{
                    date: new Date().toLocaleDateString('pt-BR'),
                    desc: "Conta VIP Criada",
                    amount: 0,
                    type: "earning"
                }]
            });

            // Atualiza estatísticas globais
            const configRef = doc(db, 'config', 'app');
            await updateDoc(configRef, { cadastrados: increment(1) }).catch(() => {});

            modalNewClient.style.display = 'none';
            alert('✅ Cliente VIP cadastrado e vinculado à sua loja com sucesso!');

            // Recarrega a tabela para exibir o cliente recém criado
            loadUsersList();

        } catch (error) {
            console.error("Erro no cadastro:", error);
            if (error.code === 'auth/email-already-in-use') {
                alert("Erro: Este e-mail já está cadastrado no sistema.");
            } else if (error.code === 'auth/weak-password') {
                alert("Erro: A senha precisa ter pelo menos 6 caracteres.");
            } else {
                alert("Erro ao criar cliente: " + error.message);
            }
        } finally {
            btnSaveNewClient.textContent = originalText;
            btnSaveNewClient.disabled = false;
        }
    });
}

if (createForm) {
  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-create-submit');
    btnSubmit.textContent = "Criando...";
    btnSubmit.disabled = true;

    const name = document.getElementById('create-name').value.trim();
    const email = document.getElementById('create-email').value.trim();
    const pass = document.getElementById('create-password').value;
    const phone = createPhone.value.trim();

    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
      const newUid = userCredential.user.uid;

      await signOut(secondaryAuth);

      const myDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const targetLojaId = myDoc.exists() ? (myDoc.data().lojaId || '') : '';

      await setDoc(doc(db, 'users', newUid), {
        name: name,
        email: email,
        phone: phone,
        role: 'cliente',
        lojaId: targetLojaId,
        createdAt: new Date().toLocaleDateString('pt-BR')
      });

      await setDoc(doc(db, 'collections', newUid), {
        items: {},
        points: 0,
        history: [{
            date: new Date().toLocaleDateString('pt-BR'),
            desc: "Conta VIP Criada na Loja",
            amount: 0,
            type: "earning"
        }]
      });

      const configRef = doc(db, 'config', 'app');
      await updateDoc(configRef, { cadastrados: increment(1) }).catch(() => {});

      createModal.style.display = 'none';
      createForm.reset();
      alert('✅ Cliente VIP cadastrado e vinculado à sua loja com sucesso!');

      loadUsersList();

    } catch (error) {
      console.error("Erro no cadastro:", error);
      if (error.code === 'auth/email-already-in-use') {
        alert("Erro: Este e-mail já está cadastrado no sistema.");
      } else if (error.code === 'auth/weak-password') {
        alert("Erro: A senha precisa ter pelo menos 6 caracteres.");
      } else {
        alert("Erro ao criar cliente: " + error.message);
      }
    } finally {
      btnSubmit.textContent = "Criar Conta";
      btnSubmit.disabled = false;
    }
  });
}

// ===================================================================
// SISTEMA DE PREENCHIMENTO RÁPIDO DE LOTES
// ===================================================================

const btnPendingLots = document.getElementById('btn-pending-lots');
const btnBackDashboard = document.getElementById('btn-back-dashboard');
const mainDashboard = document.getElementById('main-dashboard-view');
const pendingLotsView = document.getElementById('pending-lots-view');

if (btnPendingLots && btnBackDashboard) {
    btnPendingLots.addEventListener('click', () => {
        mainDashboard.style.display = 'none';
        pendingLotsView.style.display = 'block';
        window.renderPendingLots();
    });

    btnBackDashboard.addEventListener('click', () => {
        pendingLotsView.style.display = 'none';
        mainDashboard.style.display = 'block';
    });
}

window.renderPendingLots = function() {
    const grid = document.getElementById('pending-lots-grid');
    if (!grid) return;
    
    const baseDeDados = typeof RAW !== 'undefined' ? RAW : (typeof PAGE_DATA !== 'undefined' ? PAGE_DATA : []);
    const pendentes = baseDeDados.filter(car => (!car.cas || car.cas.trim() === '') && car.part);

    grid.innerHTML = '';

    if (pendentes.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: #1e293b; border-radius: 8px; color: #10b981; font-size: 18px; font-weight: bold;">🎉 Todos os lotes estão preenchidos!</div>`;
        return;
    }

    pendentes.forEach(car => {
        const card = document.createElement('div');
        card.style.cssText = "display: flex; align-items: center; gap: 15px; background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155;";
        
        card.innerHTML = `
            <img src="${car.image}" style="width: 80px; height: 80px; object-fit: contain; border-radius: 4px; background: #fff;" onerror="this.src='assets/img/placeholder.png';">
            <div style="flex: 1;">
                <div style="color: #fff; font-weight: bold; font-size: 14px; margin-bottom: 4px;">${car.name}</div>
                <div style="color: #94a3b8; font-size: 12px; margin-bottom: 8px;">SKU: <span style="color:#f59e0b;">${car.part}</span> | ${car.series || ''}</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="color: #cbd5e1; font-size: 12px; font-weight: bold;">LOTE:</label>
                    <input type="text" class="input-lote-rapido" data-part="${car.part}" maxlength="1" style="width: 50px; padding: 6px; text-align: center; font-weight: bold; font-size: 16px; background: #0f172a; color: #facc15; border: 1px solid #475569; border-radius: 4px; outline: none; text-transform: uppercase;">
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
};

window.gerarCodigoLotes = function() {
    const inputs = document.querySelectorAll('.input-lote-rapido');
    let codigoGerado = "const LOTES_ATUALIZADOS = {\n";
    let adicionados = 0;

    inputs.forEach(input => {
        const letraLote = input.value.trim().toUpperCase();
        const skuPart = input.dataset.part;
        
        if (letraLote) {
            codigoGerado += `    "${skuPart}": "${letraLote}",\n`;
            adicionados++;
        }
    });

    codigoGerado += "};\n\n";
    codigoGerado += "// === ATUALIZADOR AUTOMÁTICO DE LOTES ===\n";
    codigoGerado += "if (typeof RAW !== 'undefined') {\n";
    codigoGerado += "    RAW.forEach(carro => {\n";
    codigoGerado += "        if (LOTES_ATUALIZADOS[carro.part]) {\n";
    codigoGerado += "            carro.cas = LOTES_ATUALIZADOS[carro.part];\n";
    codigoGerado += "        }\n";
    codigoGerado += "    });\n";
    codigoGerado += "}\n";

    if (adicionados === 0) {
        alert("⚠️ Atenção: Preencha pelo menos um lote antes de gerar o código.");
        return;
    }

    const exportArea = document.getElementById('export-area');
    const textarea = document.getElementById('export-textarea');
    
    textarea.value = codigoGerado;
    exportArea.style.display = 'block';
    
    exportArea.scrollIntoView({ behavior: 'smooth' });
};


// ===================================================================
// ABRIR OS PRÊMIOS DA PRÓPRIA LOJA (GLOBAL PARA ADMIN E GERENTES)
// ===================================================================
const btnMyStoreRewards = document.getElementById('btn-my-store-rewards');
if (btnMyStoreRewards) {
    btnMyStoreRewards.addEventListener('click', async () => {
        // Puxa o ID da loja da pessoa que está logada
        lojaIdParaEditar = window.minhaLojaId || 'default';
        
        const lojaNomeEl = document.getElementById('loja-alvo-nome');
        if (lojaNomeEl) lojaNomeEl.textContent = "Loja: " + lojaIdParaEditar;
        
        const lojaModal = document.getElementById('loja-modal');
        if (lojaModal) lojaModal.style.display = 'flex';
        
        // Renderiza a lista usando a função que já existe no seu código
        await renderAdminRewards();
    });
}
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { RAW } from './data.js';

const usersTbody = document.getElementById('users-tbody');
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-user-form');

const editUid = document.getElementById('edit-uid');
const editName = document.getElementById('edit-name');
const editPhone = document.getElementById('edit-phone');
const editRole = document.getElementById('edit-role');
const btnCloseModal = document.getElementById('btn-close-modal');



let allUsersCache = [];

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

// =========================================
// 1. SEGURANÇA: Verifica se o usuário é realmente Admin
// =========================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().role === 'admin') {
        loadUsersList();
      } else {
        window.location.href = 'app.html';
      }
    } catch (err) {
      console.error("Erro na validação de Admin:", err);
      window.location.href = 'app.html';
    }
  } else {
    window.location.href = 'index.html';
  }
});

// =========================================
// 2. GESTÃO DE USUÁRIOS (Listar, Editar, Excluir)
// =========================================
async function loadUsersList() {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    if (!usersTbody) return;

    usersTbody.innerHTML = '';
    allUsersCache = [];

    querySnapshot.forEach((docSnap) => {
      const userData = docSnap.data();
      userData.uid = docSnap.id;
      allUsersCache.push(userData);

      // Define o nome e a cor do cargo na tabela
      let roleName = 'Usuário';
      let roleColor = '#64748b'; // Cinza para utilizador comum

      if (userData.role === 'admin') {
        roleName = 'Admin';
        roleColor = '#f59e0b';
      } else if (userData.role === 'cliente') {
        roleName = 'Cliente VIP';
        roleColor = '#3b82f6';
      }

      // Declare o 'tr' apenas uma vez
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Nome">${userData.name || 'Sem Nome'}</td>
        <td data-label="E-mail">${userData.email || 'Sem E-mail'}</td>
        <td data-label="Telefone">${userData.phone || 'Sem Telefone'}</td>
        <td data-label="Nascimento">${userData.birthdate || 'Não informada'}</td>
        <td data-label="Cargo"><strong style="color: ${roleColor}">${roleName}</strong></td>
        <td data-label="Ações">
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

    // AÇÃO: EDITAR
    if (e.target.classList.contains('btn-edit')) {
      const uidToEdit = e.target.getAttribute('data-id');
      openEditModal(uidToEdit);
    }

    // AÇÃO: EXCLUIR
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

  if (editUid && editName && editPhone && editRole) {
    editUid.value = userSelected.uid;
    editName.value = userSelected.name || '';
    editPhone.value = userSelected.phone || '';
    editRole.value = userSelected.role || 'user';
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
    const updatedData = {
      name: editName.value.trim(),
      phone: editPhone.value.trim(),
      role: editRole.value
    };

    try {
      await setDoc(doc(db, 'users', uid), updatedData, { merge: true });
      if (editModal) editModal.style.display = 'none';
      alert('Usuário atualizado com sucesso!');
      loadUsersList();
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      alert('Erro ao salvar as modificações: ' + error.message);
    }
  });
}

if (editPhone) {
  editPhone.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{2})(\d)/, "($1) $2");
    value = value.replace(/(\d)(\d{4})$/, "$1-$2");
    e.target.value = value;
  });
}

// =========================================
// 3. VALIDADOR DE CUPONS VIP (Novo)
// =========================================

window.validarCupom = async function () {
  const inputElement = document.getElementById('cupom-input');
  const resultDiv = document.getElementById('cupom-result');

  // Trava de segurança caso o HTML do validador não esteja na tela
  if (!inputElement || !resultDiv) return;

  const codigoInput = inputElement.value.toUpperCase().trim();

  if (!codigoInput) {
    resultDiv.innerHTML = '<p style="color: var(--red);">Por favor, digite um código de cupom.</p>';
    return;
  }

  resultDiv.innerHTML = '<p style="color: var(--muted);">⏳ Buscando no banco de dados...</p>';

  try {
    // Varre a coleção inteira de usuários
    const querySnapshot = await getDocs(collection(db, "collections"));

    let foundDocId = null;
    let foundData = null;
    let couponIndex = -1;

    querySnapshot.forEach((documento) => {
      const data = documento.data();
      // Se o usuário tiver um histórico de resgates, procura o código lá dentro
      if (data.rewards) {
        const idx = data.rewards.findIndex(r => r.codigo === codigoInput);
        if (idx !== -1) {
          foundDocId = documento.id;
          foundData = data;
          couponIndex = idx;
        }
      }
    });

    // Caso 1: Cupom não existe
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

    // Caso 2: Cupom já foi utilizado
    if (cupom.status === 'Utilizado') {
      resultDiv.innerHTML = `
                <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid #555; padding: 16px; border-radius: 8px; margin-top: 20px;">
                    <h3 style="color: #ccc; margin-bottom: 4px; font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 1px;">⚠️ Cupom já utilizado</h3>
                    <p style="font-size: 14px; color: #aaa;">Prêmio: <b>${cupom.titulo}</b></p>
                    <p style="font-size: 14px; color: #aaa;">Data do resgate: ${cupom.data}</p>
                    <p style="font-size: 12px; color: var(--red); margin-top: 10px;">Atenção: Não libere o prêmio. Este código já teve baixa no sistema.</p>
                </div>
            `;
    }
    // Caso 3: Cupom Válido e pronto para uso
    else {
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

      // Salva os dados temporariamente para a próxima função
      window.currentAdminData = foundData;
    }

  } catch (error) {
    console.error("Erro ao validar:", error);
    resultDiv.innerHTML = '<p style="color: var(--red);">Erro de conexão com o Firebase.</p>';
  }
};

window.marcarComoUtilizado = async function (docId, index) {
  const data = window.currentAdminData;

  // Altera o status localmente
  data.rewards[index].status = 'Utilizado';

  try {
    // Envia a lista atualizada de volta para o Firebase
    await setDoc(doc(db, 'collections', docId), {
      rewards: data.rewards
    }, { merge: true });

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

// =========================================
// SISTEMA DE INJEÇÃO DE CARROS (GARAGEM DO CLIENTE)
// =========================================
let currentTargetUid = null;

// Preenche o Datalist com todos os carros da base RAW
const carDatalist = document.getElementById('car-datalist');
if (carDatalist) {
  let options = '';
  RAW.forEach(car => {
    // Formato visual amigável, mas esconde o ID no final para o script resgatar
    options += `<option value="${car.year} | ${car.name} | ${car.series} | ${car.color} [ID:${car.id}]"></option>`;
  });
  carDatalist.innerHTML = options;
}

// Ouvinte de clique no botão "🚗 Garagem" da tabela
if (usersTbody) {
  usersTbody.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-manage-cars')) {
      currentTargetUid = e.target.getAttribute('data-id');
      document.getElementById('manage-user-name').textContent = e.target.getAttribute('data-name');
      document.getElementById('car-search-input').value = '';
      document.getElementById('car-qty-input').value = 1;
      document.getElementById('cars-modal').style.display = 'flex';
    }
  });
}

const PONTOS_POR_CARRO = 100;

// Botão de Salvar a Injeção
const btnSaveCar = document.getElementById('btn-save-car');
if (btnSaveCar) {
  btnSaveCar.addEventListener('click', async () => {
    if (!currentTargetUid) return;

    const searchInput = document.getElementById('car-search-input').value;
    const qtyInput = parseInt(document.getElementById('car-qty-input').value) || 0;

    // Extrai o ID do carrinho que está entre colchetes [ID:hw_...]
    const match = searchInput.match(/\[ID:(.*?)\]/);
    if (!match) {
      alert("Por favor, selecione um carro válido da lista.");
      return;
    }

    const carId = match[1];
    btnSaveCar.textContent = "Salvando...";

    try {
      // 1. Busca os dados atuais da coleção do cliente (itens e pontos antigos)
      const dRef = doc(db, 'collections', currentTargetUid);
      const snap = await getDoc(dRef);

      let userColData = snap.exists() ? snap.data().items || {} : {};
      let pontosAtuais = snap.exists() ? snap.data().points || 0 : 0;

      // Guarda a quantidade antiga para saber se aumentou
      const qtdAntiga = userColData[carId] || 0;

      // 2. Busca o perfil do usuário para verificar o Cargo/Role
      const uRef = doc(db, 'users', currentTargetUid);
      const uSnap = await getDoc(uRef);
      const userRole = uSnap.exists() ? uSnap.data().role : 'user';

      // 3. Atualiza a quantidade do carro específico
      userColData[carId] = qtyInput;

      // 4. LÓGICA HÍBRIDA DE PONTUAÇÃO: Só soma pontos se for Cargo "cliente" e a quantidade aumentou
      let novosPontos = pontosAtuais;
      if (userRole === 'cliente' && qtyInput > qtdAntiga) {
        const diferenca = qtyInput - qtdAntiga;
        novosPontos += (diferenca * PONTOS_POR_CARRO);
      }

      // 5. Salva tudo de volta no banco de dados (items + pontos atualizados)
      await setDoc(dRef, {
        items: userColData,
        points: novosPontos
      }, { merge: true });

      // Mensagem personalizada avisando se o cliente ganhou pontos ou não
      if (userRole === 'cliente' && qtyInput > qtdAntiga) {
        const ptsGanhos = (qtyInput - qtdAntiga) * PONTOS_POR_CARRO;
        alert(`✅ Sucesso! Carro injetado e +${ptsGanhos} RPMs creditados na conta do Cliente VIP!`);
      } else {
        alert("✅ Garagem atualizada com sucesso! (Nenhum ponto foi gerado pois o perfil é Usuário Comum).");
      }

      document.getElementById('car-search-input').value = ''; // Limpa o campo
      btnSaveCar.textContent = "➕ Injetar";

    } catch (error) {
      console.error("Erro ao salvar carro no painel admin:", error);
      alert("Erro ao injetar o carro. Verifique sua conexão.");
      btnSaveCar.textContent = "➕ Injetar";
    }
  });
}
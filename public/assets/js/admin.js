import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const usersTbody = document.getElementById('users-tbody');
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-user-form');

const editUid = document.getElementById('edit-uid');
const editName = document.getElementById('edit-name');
const editPhone = document.getElementById('edit-phone');
const editRole = document.getElementById('edit-role');
const btnCloseModal = document.getElementById('btn-close-modal');

let allUsersCache = [];

// 1. SEGURANÇA: Verifica se o usuário é realmente Admin
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().role === 'admin') {
        // É admin! Carrega a lista
        loadUsersList();
      } else {
        // Não é admin, expulsa para a garagem comum
        window.location.href = 'app.html';
      }
    } catch (err) {
      console.error(err);
      window.location.href = 'app.html';
    }
  } else {
    window.location.href = 'index.html';
  }
});

// 2. FUNÇÃO: Buscar e renderizar todos os usuários na Tabela
async function loadUsersList() {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    usersTbody.innerHTML = '';
    allUsersCache = [];

    querySnapshot.forEach((docSnap) => {
      const userData = docSnap.data();
      allUsersCache.push(userData);

      const tr = document.createElement('tr');
      // ADICIONADO OS DATA-LABELS EM CADA TD PARA O MODO MOBILE
      tr.innerHTML = `
        <td data-label="Nome">${userData.name || 'Sem Nome'}</td>
        <td data-label="E-mail">${userData.email || 'Sem E-mail'}</td>
        <td data-label="Telefone">${userData.phone || 'Sem Telefone'}</td>
        <td data-label="Nascimento">${userData.birthdate || 'Não informada'}</td>
        <td data-label="Cargo"><strong style="color: ${userData.role === 'admin' ? '#f59e0b' : '#64748b'}">${userData.role === 'admin' ? 'Admin' : 'Usuário'}</strong></td>
        <td data-label="Ações">
          <button class="btn-edit" data-id="${userData.uid}">Editar</button>
          <button class="btn-delete" data-id="${userData.uid}" data-name="${userData.name || 'Este usuário'}">Excluir</button>
        </td>
      `;
      usersTbody.appendChild(tr);
    });

  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    usersTbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Erro ao carregar lista de usuários.</td></tr>`;
  }
}

// =========================================
// DELEGAÇÃO DE EVENTOS: Fica FORA da função de carregamento
// =========================================
// =========================================
// DELEGAÇÃO DE EVENTOS: Cliques de Editar e Excluir
// =========================================
if (usersTbody) {
  usersTbody.addEventListener('click', async (e) => {
    // AÇÃO: EDITAR
    if (e.target.classList.contains('btn-edit')) {
      const uidToEdit = e.target.getAttribute('data-id');
      openEditModal(uidToEdit);
    }
    
    // AÇÃO: EXCLUIR (Novo)
    if (e.target.classList.contains('btn-delete')) {
      const uidToDelete = e.target.getAttribute('data-id');
      const userName = e.target.getAttribute('data-name');
      
      const confirmacao = confirm(`ATENÇÃO: Tem certeza absoluta que deseja excluir permanentemente o usuário "${userName}"? \n\nIsso apagará o perfil dele e TODOS os carrinhos da coleção dele do banco de dados!`);
      
      if (confirmacao) {
        // Guarda o texto original do botão para efeitos visuais
        const botaoOriginalText = e.target.textContent;
        e.target.textContent = "Excluindo...";
        e.target.disabled = true;

        try {
          // 1. Reduz -1 no contador global de usuários ativos
          const configRef = doc(db, 'config', 'app');
          await updateDoc(configRef, {
            cadastrados: increment(-1)
          });

          // 2. Apaga o documento da coleção de carrinhos do usuário
          await deleteDoc(doc(db, 'collections', uidToDelete));

          // 3. Apaga o documento de perfil do usuário
          await deleteDoc(doc(db, 'users', uidToDelete));

          alert('Usuário e dados de coleção deletados com sucesso!');
          loadUsersList(); // Recarrega a tabela na hora

        } catch (error) {
          console.error("Erro ao deletar usuário:", error);
          alert('Erro ao excluir usuário das tabelas: ' + error.message);
          e.target.textContent = botaoOriginalText;
          e.target.disabled = false;
        }
      }
    }
  });
}

// 3. FUNÇÃO: Abrir modal preenchido com dados atuais do usuário selecionado
function openEditModal(uid) {
  const userSelected = allUsersCache.find(u => u.uid === uid);
  if (!userSelected) return;

  editUid.value = userSelected.uid;
  editName.value = userSelected.name || '';
  editPhone.value = userSelected.phone || '';
  editRole.value = userSelected.role || 'user';

  editModal.style.display = 'flex';
}

// Fechar Modal
if (btnCloseModal) btnCloseModal.addEventListener('click', () => editModal.style.display = 'none');

// 4. FUNÇÃO: Salvar alterações no Firestore (Merge)
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
      editModal.style.display = 'none';
      alert('Usuário atualizado com sucesso!');
      loadUsersList(); // Atualiza a tabela dinamicamente com os dados novos
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      alert('Erro ao salvar as modificações: ' + error.message);
    }
  });
}

// Máscara do Telefone para o Modal
if (editPhone) {
  editPhone.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{2})(\d)/, "($1) $2");
    value = value.replace(/(\d)(\d{4})$/, "$1-$2");
    e.target.value = value;
  });
}
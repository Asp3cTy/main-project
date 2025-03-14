// Configuração da API
const API_URL = '/api';

// Estado da aplicação
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
let pedidos = [];
let currentPage = 1;
let totalPages = 1;
let editingPedidoId = null;
let tempParticipantes = [];
let tempProtocolos = [];

// Elementos DOM comuns
const formPedido = document.getElementById('form-pedido');
const btnCadastrarPedido = document.getElementById('btnCadastrarPedido');
const userGreeting = document.getElementById('userGreeting');

// Funções de inicialização
document.addEventListener('DOMContentLoaded', function () {
  // Verificar se estamos na página de login ou na página principal
  const isLoginPage = window.location.pathname.includes('login.html');

  if (isLoginPage) {
    setupLoginPage();
  } else {
    // Verificar autenticação
    if (!authToken) {
      window.location.href = 'login.html';
      return;
    }
    
    setupMainPage();
  }
});

// Funções para a página de login
function setupLoginPage() {
  // Se já estiver autenticado, redirecionar para a página principal
  if (authToken) {
    window.location.href = 'index.html';
    return;
  }
  
  // Configurar alternância entre formulários
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (loginForm && registerForm) {
    window.toggleForms = function() {
      loginForm.classList.toggle('hidden');
      registerForm.classList.toggle('hidden');
    };
  }
}

// Funções de autenticação
async function login() {
  const username = document.getElementById('loginUser').value;
  const password = document.getElementById('loginPass').value;
  
  if (!username || !password) {
    showAlert('Preencha todos os campos', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Erro no login');
    }
    
    // Salvar token e informações do usuário
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('currentUser', JSON.stringify(data.user));
    
    // Redirecionar para a página principal
    window.location.href = 'index.html';
  } catch (error) {
    showAlert(error.message, 'error');
  }
}

async function register() {
  const username = document.getElementById('registerUser').value;
  const password = document.getElementById('registerPass').value;
  const confirmPassword = document.getElementById('registerConfirmPass').value;
  
  if (!username || !password || !confirmPassword) {
    showAlert('Preencha todos os campos', 'error');
    return;
  }
  
  if (password !== confirmPassword) {
    showAlert('As senhas não coincidem', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Erro no registro');
    }
    
    showAlert('Conta criada com sucesso! Agora você pode fazer login.', 'success');
    toggleForms(); // Volta para a tela de login
  } catch (error) {
    showAlert(error.message, 'error');
  }
}

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  window.location.href = 'login.html';
}

// Funções para a página principal
function setupMainPage() {
  // Configurar saudação ao usuário
  if (userGreeting && currentUser) {
    userGreeting.textContent = `Olá, ${currentUser.username}!`;
    userGreeting.classList.remove('hidden');
  }
  
  // Inicializar datePicker com a data atual
  const dataPedido = document.getElementById('dataPedido');
  if (dataPedido) {
    const today = new Date().toISOString().split('T')[0];
    dataPedido.value = today;
  }
  
  // Adicionar listeners para os botões
  const tipoCertidao = document.getElementById('tipoCertidao');
  if (tipoCertidao) {
    tipoCertidao.addEventListener('change', function() {
      handleTipoCertidaoChange();
    });
  }
  
  const btnAddParticipante = document.getElementById('btnAddParticipante');
  if (btnAddParticipante) {
    btnAddParticipante.addEventListener('click', function() {
      openModal('modal-participante');
    });
  }
  
  const btnAddProtocolo = document.getElementById('btnAddProtocolo');
  if (btnAddProtocolo) {
    btnAddProtocolo.addEventListener('click', function() {
      openModal('modal-protocolo');
    });
  }
  
  const btnVerResumo = document.getElementById('btnVerResumo');
  if (btnVerResumo) {
    btnVerResumo.addEventListener('click', function() {
      showResumo();
    });
  }
  
  // Botões de paginação
  const btnAnterior = document.getElementById('btnAnterior');
  const btnProximo = document.getElementById('btnProximo');
  
  if (btnAnterior) {
    btnAnterior.addEventListener('click', function() {
      if (currentPage > 1) {
        currentPage--;
        loadPedidos();
      }
    });
  }
  
  if (btnProximo) {
    btnProximo.addEventListener('click', function() {
      if (currentPage < totalPages) {
        currentPage++;
        loadPedidos();
      }
    });
  }

  // Carregar pedidos
  loadPedidos();
}

// Funções de manipulação de pedidos
async function loadPedidos() {
  try {
    const response = await fetch(`${API_URL}/pedidos?page=${currentPage}&limit=5`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        // Token expirado ou inválido
        logout();
        return;
      }
      throw new Error('Erro ao carregar pedidos');
    }
    
    const data = await response.json();
    pedidos = data.pedidos || [];
    
    // Calcular total de páginas
    const total = data.pagination.total;
    const limit = data.pagination.limit;
    totalPages = Math.ceil(total / limit);
    
    // Renderizar pedidos
    renderPedidos();
  } catch (error) {
    showAlert(error.message, 'error');
  }
}

function renderPedidos() {
  const listaPedidos = document.getElementById('lista-pedidos');
  if (!listaPedidos) return;
  
  listaPedidos.innerHTML = '';
  
  if (pedidos.length === 0) {
    listaPedidos.innerHTML = `
      <div class="text-center py-6">
        <p class="text-gray-400">Nenhum pedido encontrado</p>
      </div>
    `;
    return;
  }
  
  // Criar card para cada pedido
  pedidos.forEach(pedido => {
    const card = document.createElement('div');
    card.className = 'card bg-base-200 shadow-sm mb-3';
    
    card.innerHTML = `
      <div class="card-body p-4">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="text-lg font-medium">Pedido: ${pedido.numeroPedido}</h3>
            <div class="text-sm opacity-70">
              <p>Matrícula: ${pedido.matricula}</p>
              <p>Data: ${formatDate(pedido.dataPedido)}</p>
              <p>Resultado: ${pedido.resultadoOnus}</p>
            </div>
          </div>
          <div>
            <span class="badge badge-accent mr-2">
              ${pedido.participantes_count || 0} Participante(s)
            </span>
            <span class="badge badge-secondary">
              ${pedido.protocolos_count || 0} Protocolo(s)
            </span>
          </div>
        </div>
        <div class="card-actions justify-end mt-2">
          <button class="btn btn-sm btn-outline btn-info" onclick="editarPedido(${pedido.id})">
            Editar
          </button>
          <button class="btn btn-sm btn-outline btn-error" onclick="excluirPedido(${pedido.id})">
            Excluir
          </button>
        </div>
      </div>
    `;
    
    listaPedidos.appendChild(card);
  });
}

async function cadastrarOuAlterarPedido() {
  // Coletar dados do formulário
  const numeroPedido = document.getElementById('numeroPedido').value;
  const dataPedido = document.getElementById('dataPedido').value;
  const matricula = document.getElementById('matricula').value;
  const resultadoOnus = document.getElementById('resultadoOnus').value;
  const numFolhas = document.getElementById('numFolhas').value;
  const numImagens = document.getElementById('numImagens').value;
  const tipoCertidao = document.getElementById('tipoCertidao').value;
  const codigoCertidao = document.getElementById('inputCodigoCertidao')?.value || '';
  
  // Validações básicas
  if (!numeroPedido || !dataPedido || !matricula) {
    showAlert('Preencha os campos obrigatórios', 'error');
    return;
  }
  
  // Construir objeto pedido
  const pedidoData = {
    numeroPedido,
    dataPedido,
    matricula,
    resultadoOnus,
    numFolhas,
    numImagens,
    tipoCertidao,
    codigoCertidao,
    participantes: tempParticipantes,
    protocolos: tempProtocolos
  };
  
  try {
    let url = `${API_URL}/pedidos`;
    let method = 'POST';
    
    // Se estiver editando, use PUT e o ID correto
    if (editingPedidoId) {
      url = `${API_URL}/pedidos/${editingPedidoId}`;
      method = 'PUT';
    }
    
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(pedidoData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao processar pedido');
    }
    
    // Exibir mensagem de sucesso e resetar formulário
    showAlert(
      editingPedidoId ? 'Pedido atualizado com sucesso!' : 'Pedido cadastrado com sucesso!', 
      'success'
    );
    
    resetForm();
    loadPedidos(); // Recarregar lista de pedidos
  } catch (error) {
    showAlert(error.message, 'error');
  }
}

function resetForm() {
  formPedido.reset();
  
  // Resetar dados temporários
  tempParticipantes = [];
  tempProtocolos = [];
  editingPedidoId = null;
  
  // Resetar texto do botão
  if (btnCadastrarPedido) {
    btnCadastrarPedido.textContent = 'Cadastrar';
  }
  
  // Resetar data para o dia atual
  const dataPedido = document.getElementById('dataPedido');
  if (dataPedido) {
    const today = new Date().toISOString().split('T')[0];
    dataPedido.value = today;
  }
  
  // Esconder campo de código se necessário
  handleTipoCertidaoChange();
}

async function editarPedido(id) {
  try {
    const response = await fetch(`${API_URL}/pedidos/${id}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Erro ao carregar dados do pedido');
    }
    
    const data = await response.json();
    const { pedido, participantes, protocolos } = data;
    
    // Preencher formulário com dados
    document.getElementById('numeroPedido').value = pedido.numeroPedido;
    document.getElementById('dataPedido').value = pedido.dataPedido;
    document.getElementById('matricula').value = pedido.matricula;
    document.getElementById('resultadoOnus').value = pedido.resultadoOnus;
    document.getElementById('numFolhas').value = pedido.numFolhas || '';
    document.getElementById('numImagens').value = pedido.numImagens || '';
    document.getElementById('tipoCertidao').value = pedido.tipoCertidao;
    
    // Mostrar campo de código se necessário
    handleTipoCertidaoChange();
    
    // Preencher campo de código se existir
    if (pedido.codigoCertidao && document.getElementById('inputCodigoCertidao')) {
      document.getElementById('inputCodigoCertidao').value = pedido.codigoCertidao;
    }
    
    // Salvar participantes e protocolos temporários
    tempParticipantes = participantes || [];
    tempProtocolos = protocolos || [];
    
    // Marcar que estamos editando
    editingPedidoId = pedido.id;
    
    // Atualizar texto do botão
    if (btnCadastrarPedido) {
      btnCadastrarPedido.textContent = 'Confirmar Alteração';
    }
    
    // Rolar para o topo para visualizar o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    showAlert(error.message, 'error');
  }
}

async function excluirPedido(id) {
  if (!confirm('Tem certeza que deseja excluir este pedido?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/pedidos/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Erro ao excluir pedido');
    }
    
    showAlert('Pedido excluído com sucesso!', 'success');
    loadPedidos(); // Recarregar lista
  } catch (error) {
    showAlert(error.message, 'error');
  }
}

// Funções para participantes
function openModalParticipante(participanteIndex = null) {
  // Configurar modal para edição ou adição
  document.getElementById('tituloModalParticipante').textContent = 
    participanteIndex !== null ? 'Editar Participante' : 'Adicionar Participante';
  
  const form = document.getElementById('form-participante');
  if (form) form.reset();
  
  // Se for edição, preencher com dados existentes
  if (participanteIndex !== null) {
    const participante = tempParticipantes[participanteIndex];
    
    document.getElementById('part-qualificacao').value = participante.qualificacao;
    document.getElementById('part-nome').value = participante.nome;
    document.getElementById('tipoDocumento').value = participante.tipoDocumento;
    
    // Alternar entre CPF/CNPJ
    handleTipoDocumentoChange();
    
    if (participante.tipoDocumento === 'CPF') {
      document.getElementById('inputCPF').value = participante.cpf || '';
      document.getElementById('part-genero').value = participante.genero || 'MASCULINO';
      document.getElementById('part-identidade').value = participante.identidade || '';
      document.getElementById('part-estadoCivil').value = participante.estadoCivil || 'SOLTEIRO';
      
      // Configurar órgão emissor
      if (participante.orgaoEmissor === 'DETRAN/RJ' || participante.orgaoEmissor === 'IFP/RJ') {
        document.getElementById('orgaoEmissorSelect').value = participante.orgaoEmissor;
        document.getElementById('divOrgaoEmissorInput').classList.add('hidden');
      } else {
        document.getElementById('orgaoEmissorSelect').value = 'OUTRO';
        document.getElementById('orgaoEmissorOutro').value = participante.orgaoEmissor || '';
        document.getElementById('divOrgaoEmissorInput').classList.remove('hidden');
      }
    } else {
      document.getElementById('inputCNPJ').value = participante.cnpj || '';
    }
    
    // Salvar índice para edição
    document.getElementById('btnConfirmarParticipante').setAttribute('data-edit-index', participanteIndex);
  } else {
    // Resetar índice de edição
    document.getElementById('btnConfirmarParticipante').removeAttribute('data-edit-index');
  }
  
  openModal('modal-participante');
}

function confirmarParticipante() {
  // Coletar dados do formulário
  const qualificacao = document.getElementById('part-qualificacao').value;
  const nome = document.getElementById('part-nome').value;
  const tipoDocumento = document.getElementById('tipoDocumento').value;
  
  // Validar campos básicos
  if (!nome) {
    showAlert('Nome é obrigatório', 'error');
    return;
  }
  
  // Construir objeto participante
  const participante = {
    qualificacao,
    nome: nome.toUpperCase(),
    tipoDocumento
  };
  
  // Adicionar campos específicos com base no tipo de documento
  if (tipoDocumento === 'CPF') {
    participante.cpf = document.getElementById('inputCPF').value;
    participante.genero = document.getElementById('part-genero').value;
    participante.identidade = document.getElementById('part-identidade').value;
    participante.estadoCivil = document.getElementById('part-estadoCivil').value;
    
    // Determinar órgão emissor
    const orgaoEmissorSelect = document.getElementById('orgaoEmissorSelect').value;
    if (orgaoEmissorSelect === 'OUTRO') {
      participante.orgaoEmissor = document.getElementById('orgaoEmissorOutro').value;
    } else {
      participante.orgaoEmissor = orgaoEmissorSelect;
    }
  } else {
    participante.cnpj = document.getElementById('inputCNPJ').value;
  }
  
  // Verificar se é edição ou adição
  const editIndex = document.getElementById('btnConfirmarParticipante').getAttribute('data-edit-index');
  
  if (editIndex !== null && editIndex !== undefined) {
    // Edição
    tempParticipantes[editIndex] = participante;
  } else {
    // Adição
    tempParticipantes.push(participante);
  }
  
  fecharModal('modal-participante');
  showAlert('Participante salvo!', 'success');
}

// Funções para protocolos
function openModalProtocolo(protocoloIndex = null) {
  // Configurar modal para edição ou adição
  document.getElementById('tituloModalProtocolo').textContent = 
    protocoloIndex !== null ? 'Editar Protocolo' : 'Adicionar Protocolo';
  
  const form = document.getElementById('form-protocolo');
  if (form) form.reset();
  
  // Se for edição, preencher com dados existentes
  if (protocoloIndex !== null) {
    const protocolo = tempProtocolos[protocoloIndex];
    document.getElementById('proto-observacao').value = protocolo.observacao;
    
    // Salvar índice para edição
    document.getElementById('btnConfirmarProtocolo').setAttribute('data-edit-index', protocoloIndex);
  } else {
    // Resetar índice de edição
    document.getElementById('btnConfirmarProtocolo').removeAttribute('data-edit-index');
  }
  
  openModal('modal-protocolo');
}

function confirmarProtocolo() {
  // Coletar dados do formulário
  const observacao = document.getElementById('proto-observacao').value;
  
  // Validar
  if (!observacao) {
    showAlert('Observação é obrigatória', 'error');
    return;
  }
  
  // Construir objeto protocolo
  const protocolo = { observacao };
  
  // Verificar se é edição ou adição
  const editIndex = document.getElementById('btnConfirmarProtocolo').getAttribute('data-edit-index');
  
  if (editIndex !== null && editIndex !== undefined) {
    // Edição
    tempProtocolos[editIndex] = protocolo;
  } else {
    // Adição
    tempProtocolos.push(protocolo);
  }
  
  fecharModal('modal-protocolo');
  showAlert('Protocolo salvo!', 'success');
}

// Função para exibir resumo de participantes e protocolos
function showResumo() {
  const listaParticipantes = document.getElementById('lista-participantes');
  const listaProtocolos = document.getElementById('lista-protocolos');
  
  if (listaParticipantes) {
    listaParticipantes.innerHTML = '';
    
    if (tempParticipantes.length === 0) {
      listaParticipantes.innerHTML = '<li class="text-gray-400">Nenhum participante adicionado</li>';
    } else {
      tempParticipantes.forEach((p, index) => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center border-b pb-1';
        
        li.innerHTML = `
          <div>
            <strong>${p.qualificacao}:</strong> ${p.nome}
            <br>
            <small>${p.tipoDocumento === 'CPF' ? p.cpf : p.cnpj}</small>
          </div>
          <div>
            <button class="btn btn-xs btn-ghost text-info" onclick="openModalParticipante(${index})">Editar</button>
            <button class="btn btn-xs btn-ghost text-error" onclick="removerParticipante(${index})">Remover</button>
          </div>
        `;
        
        listaParticipantes.appendChild(li);
      });
    }
  }
  
  if (listaProtocolos) {
    listaProtocolos.innerHTML = '';
    
    if (tempProtocolos.length === 0) {
      listaProtocolos.innerHTML = '<li class="text-gray-400">Nenhum protocolo adicionado</li>';
    } else {
      tempProtocolos.forEach((p, index) => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center border-b pb-1';
        
        li.innerHTML = `
          <div>
            ${p.observacao}
          </div>
          <div>
            <button class="btn btn-xs btn-ghost text-info" onclick="openModalProtocolo(${index})">Editar</button>
            <button class="btn btn-xs btn-ghost text-error" onclick="removerProtocolo(${index})">Remover</button>
          </div>
        `;
        
        listaProtocolos.appendChild(li);
      });
    }
  }
  
  openModal('modal-resumo');
}

function removerParticipante(index) {
  if (confirm('Tem certeza que deseja remover este participante?')) {
    tempParticipantes.splice(index, 1);
    showResumo(); // Atualizar modal
  }
}

function removerProtocolo(index) {
  if (confirm('Tem certeza que deseja remover este protocolo?')) {
    tempProtocolos.splice(index, 1);
    showResumo(); // Atualizar modal
  }
}

// Funções de utilidade
function handleTipoCertidaoChange() {
  const tipoCertidao = document.getElementById('tipoCertidao').value;
  const divCodigoCertidao = document.getElementById('divCodigoCertidao');
  const labelCodigoCertidao = document.getElementById('labelCodigoCertidao');
  
  if (!divCodigoCertidao || !labelCodigoCertidao) return;
  
  if (tipoCertidao === 'ARIRJ' || tipoCertidao === 'E-CARTÓRIO') {
    divCodigoCertidao.classList.remove('hidden');
    labelCodigoCertidao.textContent = tipoCertidao === 'ARIRJ' ? 'CÓDIGO ARIRJ' : 'CÓDIGO E-CARTÓRIO';
  } else {
    divCodigoCertidao.classList.add('hidden');
  }
}

function handleTipoDocumentoChange() {
  const tipoDocumento = document.getElementById('tipoDocumento').value;
  const divCPF = document.getElementById('divCPF');
  const divCNPJ = document.getElementById('divCNPJ');
  const divGenero = document.getElementById('divGenero');
  const divIdentidade = document.getElementById('divIdentidade');
  const divOrgaoEmissorSelect = document.getElementById('divOrgaoEmissorSelect');
  const divEstadoCivil = document.getElementById('divEstadoCivil');
  
  if (tipoDocumento === 'CPF') {
    divCPF.classList.remove('hidden');
    divCNPJ.classList.add('hidden');
    divGenero.classList.remove('hidden');
    divIdentidade.classList.remove('hidden');
    divOrgaoEmissorSelect.classList.remove('hidden');
    divEstadoCivil.classList.remove('hidden');
  } else {
    divCPF.classList.add('hidden');
    divCNPJ.classList.remove('hidden');
    divGenero.classList.add('hidden');
    divIdentidade.classList.add('hidden');
    divOrgaoEmissorSelect.classList.add('hidden');
    divEstadoCivil.classList.add('hidden');
  }
}

function handleOrgaoEmissor() {
  const orgaoEmissorSelect = document.getElementById('orgaoEmissorSelect').value;
  const divOrgaoEmissorInput = document.getElementById('divOrgaoEmissorInput');
  
  if (orgaoEmissorSelect === 'OUTRO') {
    divOrgaoEmissorInput.classList.remove('hidden');
  } else {
    divOrgaoEmissorInput.classList.add('hidden');
  }
}

function openModal(modalId) {
  document.getElementById(modalId).checked = true;
}

function fecharModal(modalId) {
  document.getElementById(modalId).checked = false;
}

// Função para exibir alertas
function showAlert(message, type) {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = `alert ${getAlertClass(type)} alert-animation`;
  toast.innerHTML = `
    <div>
      <span>${message}</span>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Remover após 3 segundos
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 500);
  }, 3000);
}

function getAlertClass(type) {
  switch (type) {
    case 'success': return 'alert-success';
    case 'error': return 'alert-error';
    case 'warning': return 'alert-warning';
    case 'info': return 'alert-info';
    default: return 'alert-info';
  }
}

// Função para formatar data
function formatDate(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  } catch (e) {
    return dateString;
  }
}

// Expor funções para uso global (para botões HTML)
window.login = login;
window.register = register;
window.logout = logout;
window.cadastrarOuAlterarPedido = cadastrarOuAlterarPedido;
window.editarPedido = editarPedido;
window.excluirPedido = excluirPedido;
window.openModalParticipante = openModalParticipante;
window.confirmarParticipante = confirmarParticipante;
window.openModalProtocolo = openModalProtocolo;
window.confirmarProtocolo = confirmarProtocolo;
window.showResumo = showResumo;
window.removerParticipante = removerParticipante;
window.removerProtocolo = removerProtocolo;
window.handleTipoCertidaoChange = handleTipoCertidaoChange;
window.handleTipoDocumentoChange = handleTipoDocumentoChange;
window.handleOrgaoEmissor = handleOrgaoEmissor;
window.openModal = openModal;
window.fecharModal = fecharModal;
window.exportToCsv = exportToCsv;
window.copyToClipboard = copyToClipboard;
window.gerarPreviewCertificado = gerarPreviewCertificado;

// Funções para validação e formatação de campos

// Máscara para CPF
document.addEventListener('DOMContentLoaded', function() {
  const inputCPF = document.getElementById('inputCPF');
  if (inputCPF) {
    inputCPF.addEventListener('input', function() {
      let value = this.value.replace(/\D/g, '');
      if (value.length > 11) value = value.slice(0, 11);
      
      if (value.length > 9) {
        value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2}).*/, '$1.$2.$3-$4');
      } else if (value.length > 6) {
        value = value.replace(/^(\d{3})(\d{3})(\d{1,3}).*/, '$1.$2.$3');
      } else if (value.length > 3) {
        value = value.replace(/^(\d{3})(\d{1,3}).*/, '$1.$2');
      }
      
      this.value = value;
    });
  }
  
  // Máscara para CNPJ
  const inputCNPJ = document.getElementById('inputCNPJ');
  if (inputCNPJ) {
    inputCNPJ.addEventListener('input', function() {
      let value = this.value.replace(/\D/g, '');
      if (value.length > 14) value = value.slice(0, 14);
      
      if (value.length > 12) {
        value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
      } else if (value.length > 8) {
        value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4}).*/, '$1.$2.$3/$4');
      } else if (value.length > 5) {
        value = value.replace(/^(\d{2})(\d{3})(\d{1,3}).*/, '$1.$2.$3');
      } else if (value.length > 2) {
        value = value.replace(/^(\d{2})(\d{1,3}).*/, '$1.$2');
      }
      
      this.value = value;
    });
  }
  
  // Campo de número de pedido - apenas números
  const numeroPedido = document.getElementById('numeroPedido');
  if (numeroPedido) {
    numeroPedido.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '').substring(0, 6);
    });
  }
  
  // Campo de matrícula - apenas números
  const matricula = document.getElementById('matricula');
  if (matricula) {
    matricula.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '').substring(0, 5);
    });
  }
  
  // Campos de número de folhas e imagens - apenas números, 2 dígitos
  const numFolhas = document.getElementById('numFolhas');
  if (numFolhas) {
    numFolhas.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '').substring(0, 2);
    });
  }
  
  const numImagens = document.getElementById('numImagens');
  if (numImagens) {
    numImagens.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '').substring(0, 2);
    });
  }
});

// Função para converter inputs para maiúsculo
function convertToUppercase(input) {
  if (!input) return;
  input.value = input.value.toUpperCase();
}

// Adicionar listener para converter inputs específicos para maiúsculo ao perder o foco
document.addEventListener('DOMContentLoaded', function() {
  const upperCaseInputs = document.querySelectorAll('[data-uppercase="true"]');
  upperCaseInputs.forEach(input => {
    input.addEventListener('blur', function() {
      convertToUppercase(this);
    });
  });
  
  // Converter nome do participante para maiúsculo
  const partNome = document.getElementById('part-nome');
  if (partNome) {
    partNome.addEventListener('blur', function() {
      convertToUppercase(this);
    });
  }
  
  // Converter código ARIRJ ou E-CARTÓRIO para maiúsculo
  const inputCodigoCertidao = document.getElementById('inputCodigoCertidao');
  if (inputCodigoCertidao) {
    inputCodigoCertidao.addEventListener('blur', function() {
      convertToUppercase(this);
    });
  }
  
  // Converter órgão emissor "outro" para maiúsculo
  const orgaoEmissorOutro = document.getElementById('orgaoEmissorOutro');
  if (orgaoEmissorOutro) {
    orgaoEmissorOutro.addEventListener('blur', function() {
      convertToUppercase(this);
    });
  }
});

// Funções auxiliares para copiar para clipboard
function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => {
        showAlert('Copiado para a área de transferência!', 'success');
      })
      .catch(err => {
        showAlert('Erro ao copiar texto', 'error');
        console.error('Erro ao copiar texto: ', err);
      });
  } else {
    // Fallback para navegadores mais antigos
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      const msg = successful ? 'Copiado com sucesso!' : 'Falha ao copiar';
      showAlert(msg, successful ? 'success' : 'error');
    } catch (err) {
      showAlert('Erro ao copiar texto', 'error');
      console.error('Erro ao copiar texto: ', err);
    }
    
    document.body.removeChild(textArea);
  }
}

// Função para exportar dados para CSV
function exportToCsv() {
  if (pedidos.length === 0) {
    showAlert('Nenhum pedido para exportar', 'warning');
    return;
  }
  
  // Construir cabeçalho CSV
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Número do Pedido,Data,Matrícula,Resultado,Folhas,Imagens,Tipo\n";
  
  // Adicionar linhas para cada pedido
  pedidos.forEach(pedido => {
    const row = [
      pedido.numeroPedido || '',
      pedido.dataPedido || '',
      pedido.matricula || '',
      pedido.resultadoOnus || '',
      pedido.numFolhas || '',
      pedido.numImagens || '',
      pedido.tipoCertidao || ''
    ].map(cell => `"${cell}"`).join(',');
    
    csvContent += row + '\n';
  });
  
  // Criar link de download
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `pedidos_${formatDate(new Date())}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Funções para pré-visualização de certificado 
function gerarPreviewCertificado(pedidoId) {
  // Buscar dados do pedido específico para gerar preview
  fetch(`${API_URL}/pedidos/${pedidoId}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  })
  .then(response => response.json())
  .then(data => {
    if (data.pedido) {
      // Abrir modal de preview
      openPreviewModal(data);
    } else {
      showAlert('Erro ao carregar dados do pedido', 'error');
    }
  })
  .catch(error => {
    showAlert('Erro ao gerar preview do certificado', 'error');
    console.error('Erro ao gerar preview:', error);
  });
}

function openPreviewModal(data) {
  // Aqui você implementaria a lógica para mostrar um modal com a pré-visualização
  // do certificado baseado nos dados do pedido
  // Este é apenas um exemplo, você precisaria criar o modal adequado no HTML
  alert('Função de preview ainda não implementada completamente.');
}

// Funções para busca e filtro
function setupSearch() {
  const searchInput = document.getElementById('searchPedidos');
  if (!searchInput) return;
  
  searchInput.addEventListener('input', debounce(function() {
    currentPage = 1; // Reset para primeira página
    loadPedidos(this.value);
  }, 500));
}

// Função debounce para evitar chamadas excessivas durante digitação
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Sincronização offline e armazenamento local
function setupOfflineMode() {
  // Verificar se o navegador tem suporte para IndexedDB
  if (!window.indexedDB) {
    console.warn('Seu navegador não suporta IndexedDB, o modo offline não estará disponível.');
    return;
  }
  
  // Configuração do banco de dados local
  const dbPromise = window.indexedDB.open('mycert-offline', 1);
  
  dbPromise.onupgradeneeded = function(event) {
    const db = event.target.result;
    
    // Criar tabelas no IndexedDB
    if (!db.objectStoreNames.contains('pendingRequests')) {
      db.createObjectStore('pendingRequests', { keyPath: 'id', autoIncrement: true });
    }
    
    if (!db.objectStoreNames.contains('cachedPedidos')) {
      db.createObjectStore('cachedPedidos', { keyPath: 'id' });
    }
  };
  
  // Verificar conexão e sincronizar quando online
  window.addEventListener('online', function() {
    showAlert('Conexão restabelecida! Sincronizando dados...', 'info');
    syncPendingRequests();
  });
  
  window.addEventListener('offline', function() {
    showAlert('Você está offline. Algumas funcionalidades podem estar limitadas.', 'warning');
  });
}

async function syncPendingRequests() {
  // Implementação da sincronização de requisições pendentes quando voltar online
  console.log('Sincronizando requisições pendentes...');
  // Aqui você implementaria a lógica para buscar requisições pendentes no IndexedDB
  // e enviá-las para o servidor
}

// Inicialização adicional
document.addEventListener('DOMContentLoaded', function() {
  setupSearch();
  setupOfflineMode();
});

/*******************************************
 * CONFIGURAÇÃO PARA A API (Node + Express)
 *******************************************/
const API_URL = "https://main-project-1-6hja.onrender.com"; // Ajuste se seu servidor estiver em outra porta/URL

// Quando quisermos de fato EDITAR/EXCLUIR pedidos no banco,
// precisamos implementar rotas PUT/DELETE no servidor.
// Por enquanto, aqui só farei POST e GET.

/*******************************************
 * Estados Locais
 *******************************************/
// `pedidos` será atualizado após cada GET /pedidos no servidor
let pedidos = [];

// "Paginação": quantos itens por página, página atual etc.
const itensPorPagina = 2;
let paginaAtual = 1; // começa na página 1

// Arrays TEMPORÁRIOS para manipular Participantes e Protocolos
// enquanto estamos criando/alterando um pedido
let participantesTemp = [];
let protocolosTemp = [];


let editandoParticipanteIndex = null;
let editandoProtocoloIndex = null;

// Para resetar campos se trocar de CPF para CNPJ
let docTypeAnterior = "CPF";

/*******************************************
 * Ao carregar a página
 *******************************************/
window.addEventListener("DOMContentLoaded", () => {
  // Seta data do dia no form do pedido
  const dataPedidoInput = document.getElementById("dataPedido");
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  dataPedidoInput.value = `${ano}-${mes}-${dia}`;

  // Botões para abrir modais
  document.getElementById("btnAddParticipante").addEventListener("click", () => {
    abrirModal("modal-participante");
    limparFormularioParticipante();
    editandoParticipanteIndex = null;
    document.getElementById("tituloModalParticipante").textContent = "Adicionar Participante";
    document.getElementById("btnConfirmarParticipante").textContent = "Confirmar Participante";
  });

  document.getElementById("btnAddProtocolo").addEventListener("click", () => {
    abrirModal("modal-protocolo");
    limparFormularioProtocolo();
    editandoProtocoloIndex = null;
    document.getElementById("tituloModalProtocolo").textContent = "Adicionar Protocolo";
    document.getElementById("btnConfirmarProtocolo").textContent = "Confirmar Protocolo";
  });

  // Botão "Visualizar Participantes e Protocolos"
  document.getElementById("btnVerResumo").addEventListener("click", () => {
    abrirModal("modal-resumo");
    renderizarResumoModal();
  });

  // Nome do participante sempre em maiúsculo
  const nomeInput = document.getElementById("part-nome");
  nomeInput.addEventListener("input", () => {
    nomeInput.value = nomeInput.value.toUpperCase();
  });

  // Paginação: botões Anterior/Próximo
  document.getElementById("btnAnterior").addEventListener("click", paginaAnterior);
  document.getElementById("btnProximo").addEventListener("click", paginaProxima);

  // Lidar com a troca do Tipo da Certidão (para exibir Código ARIRJ/E-CARTÓRIO)
  const tipoCertidaoSelect = document.getElementById("tipoCertidao");
  tipoCertidaoSelect.addEventListener("change", exibirCampoCodigoSeNecessario);

  // Exibir/ocultar campo no carregamento inicial
  exibirCampoCodigoSeNecessario();

  // Ao iniciar, podemos listar pedidos do servidor:
  listarPedidosDoServidor();
});

/*******************************************
 * 1. Funções de Abrir/Fechar Modal
 *******************************************/
function abrirModal(modalId) {
  document.getElementById(modalId).checked = true;
}
function fecharModal(modalId) {
  document.getElementById(modalId).checked = false;
}

/*******************************************
 * 2. Cadastrar OU Alterar Pedido
 *******************************************/
function cadastrarOuAlterarPedido() {
  const form = document.getElementById("form-pedido");
  const dataForm = new FormData(form);

  // Monta objeto de pedido (no mesmo formato da API)
  const payload = {
    numeroPedido: dataForm.get("numeroPedido"),
    data: dataForm.get("data"), // "YYYY-MM-DD"
    matricula: dataForm.get("matricula"),
    resultadoOnus: dataForm.get("resultadoOnus"),
    numFolhas: dataForm.get("numFolhas"),
    numImagens: dataForm.get("numImagens"),
    tipoCertidao: dataForm.get("tipoCertidao"),
    codigoCertidao: dataForm.get("codigoCertidao") || "",
    participantes: [...participantesTemp], // array
    protocolos: [...protocolosTemp],       // array
  };

  if (editandoPedidoIndex === null) {
    // Modo "Novo Pedido" -> Enviar POST para o servidor
    fetch(`${API_URL}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Erro ao criar pedido");
        }
        return res.json();
      })
      .then((dados) => {
        console.log("Pedido cadastrado:", dados);
        alert(dados.message || "Pedido excluído com sucesso!");
        // Limpa form
        limparPedidoForm();
        // Recarrega do servidor
        listarPedidosDoServidor();
      })
      .catch((err) => {
        console.error(err);
        alert("Falha ao criar pedido no servidor.");
      });
  } else {
    // Modo "Edição de Pedido" (local)
    // OBS: Se quiser persistir no DB, precisamos de PUT /pedidos/:id no servidor
    pedidos[editandoPedidoIndex] = payload;
    editandoPedidoIndex = null;
    document.getElementById("tituloFormPedido").textContent = "Novo Pedido";
    document.getElementById("btnCadastrarPedido").textContent = "Cadastrar";
    document.getElementById("tituloPrincipal").textContent = "Sistema de Pedidos";

    limparPedidoForm();

    // Re-render local
    listarPedidosDoServidor()
    renderListaPedidos();
  }
}

/*******************************************
 * 2.1 Função para limpar o formulário do pedido
 *******************************************/
function limparPedidoForm() {
  const form = document.getElementById("form-pedido");
  form.reset();

  // Redefine data do dia
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  document.getElementById("dataPedido").value = `${ano}-${mes}-${dia}`;

  // Limpa arrays temporários
  participantesTemp = [];
  protocolosTemp = [];

  // Ocultar campo de código
  document.getElementById("divCodigoCertidao").classList.add("hidden");
}

/*******************************************
 * 2.2 Função para listar pedidos do Servidor
 *  -> Atualiza a array local `pedidos` e chama renderListaPedidos()
 *******************************************/
function listarPedidosDoServidor() {
  fetch(`${API_URL}/pedidos`)
    .then((res) => {
      if (!res.ok) {
        throw new Error("Erro ao obter pedidos do servidor");
      }
      return res.json();
    })
    .then((dados) => {
      // `dados` é um array de pedidos vindos do server
      // no formato: [ { numeroPedido, data, matricula, participantes, protocolos }, ... ]
      pedidos = dados;
      paginaAtual = 1; // volta pra primeira página
      renderListaPedidos();
    })
    .catch((err) => {
      console.error(err);
      alert("Falha ao obter pedidos do servidor.");
    });
}

/*******************************************
 * 3. Renderizar Lista de Pedidos (com paginação)
 *******************************************/

function formatarDataISOParaBR(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) {
    // se não for data válida, apenas retorna a string original
    return isoString;
  }
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}


function renderListaPedidos() {
  const container = document.getElementById("lista-pedidos");
  container.innerHTML = "";

  // Defina quantos itens por página
  const itensPorPagina = 2;

  // Garante que 'pedidos' esteja em ordem (desc) se não estiver. 
  // Se seu back-end já retorna ORDER BY id DESC, não precisa mexer:
  // pedidos.sort((a, b) => b.id - a.id);

  const totalPedidos = pedidos.length;
  const startIndex = (paginaAtual - 1) * itensPorPagina;
  const endIndex = startIndex + itensPorPagina;
  const paginaPedidos = pedidos.slice(startIndex, endIndex);

  paginaPedidos.forEach((pedido, indexRelativo) => {
    const indexAbsoluto = startIndex + indexRelativo;

    // Formatar data ISO -> dd/mm/yyyy
    const dataFormatada = formatarDataISOParaBR(pedido.data);

    // Cores do resultado Onus
    let corOnus = "";
    if (pedido.resultadoOnus === "NEGATIVA") {
      corOnus = "colorNegative";
    } else if (pedido.resultadoOnus === "POSITIVA") {
      corOnus = "colorPositive";
    } else if (pedido.resultadoOnus === "INDETERMINADA") {
      corOnus = "colorIndertimine";
    }

    // Mostra Código Arirj/E-Cartório
    let textoCodigo = "";
    if (pedido.tipoCertidao === "ARIRJ") {
      textoCodigo = `<p><strong>CÓDIGO ARIRJ:</strong> ${pedido.codigoCertidao}</p>`;
    } else if (pedido.tipoCertidao === "E-CARTÓRIO") {
      textoCodigo = `<p><strong>CÓDIGO E-CARTÓRIO:</strong> ${pedido.codigoCertidao}</p>`;
    }

    // Monta participantes (botão “Copiar Doc” menor)
    let htmlParticipantes = "";
    if (!pedido.participantes || pedido.participantes.length === 0) {
      htmlParticipantes = "<p>Nenhum participante</p>";
    } else {
      pedido.participantes.forEach((p) => {
        const orgaoFinal = (p.orgaoEmissorSelect === "OUTRO") ? p.orgaoEmissorOutro : p.orgaoEmissorSelect;
        if (p.tipoDocumento === "CPF") {
          htmlParticipantes += `
            <p>
              ${p.qualificacao} - ${p.nome} - ${p.cpf} - ${p.genero} - ${p.identidade} - ${orgaoFinal} - ${p.estadoCivil}
<!-- Ícone de Copiar -->
     <button class="btnCopy" onclick="copiarDocumento('${p.cpf}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFFFFF" d="M 18.5 5 C 15.467 5 13 7.467 13 10.5 L 13 32.5 C 13 35.533 15.467 38 18.5 38 L 34.5 38 C 37.533 38 40 35.533 40 32.5 L 40 10.5 C 40 7.467 37.533 5 34.5 5 L 18.5 5 z M 11 10 L 9.78125 10.8125 C 8.66825 11.5545 8 12.803625 8 14.140625 L 8 33.5 C 8 38.747 12.253 43 17.5 43 L 30.859375 43 C 32.197375 43 33.4465 42.33175 34.1875 41.21875 L 35 40 L 17.5 40 C 13.91 40 11 37.09 11 33.5 L 11 10 z"></path>
          </svg>
          <span class="tooltip">Copiar CPF de ${p.nome}</span>
        </button>
            </p>
          `;
        } else {
          // CNPJ
          htmlParticipantes += `
            <p>
              ${p.qualificacao} - ${p.nome} - ${p.cnpj}
<!-- Ícone de Copiar -->
     <button class="btnCopy" onclick="copiarDocumento('${p.cnpj}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFFFFF" d="M 18.5 5 C 15.467 5 13 7.467 13 10.5 L 13 32.5 C 13 35.533 15.467 38 18.5 38 L 34.5 38 C 37.533 38 40 35.533 40 32.5 L 40 10.5 C 40 7.467 37.533 5 34.5 5 L 18.5 5 z M 11 10 L 9.78125 10.8125 C 8.66825 11.5545 8 12.803625 8 14.140625 L 8 33.5 C 8 38.747 12.253 43 17.5 43 L 30.859375 43 C 32.197375 43 33.4465 42.33175 34.1875 41.21875 L 35 40 L 17.5 40 C 13.91 40 11 37.09 11 33.5 L 11 10 z"></path>
          </svg>
                    <span class="tooltip">Copiar CNPJ de ${p.nome}</span>
        </button>
            </p>
          `;
        }
      });
    }

// Monta protocolos corretamente com quebra de linha
let htmlProtocolos = "";
if (!pedido.protocolos || pedido.protocolos.length === 0) {
  htmlProtocolos = "<p class='break-words w-full'>Nenhum protocolo</p>";
} else {
  htmlProtocolos = `<div class="space-y-2 w-full break-words overflow-hidden">`;
  pedido.protocolos.forEach((prot) => {
    htmlProtocolos += `
      <div class="flex w-full items-center justify-between">
        <p class="break-words w-full overflow-hidden whitespace-normal inline">${prot}        <button class="btnCopy" onclick="copiarDocumento('${prot}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFFFFF" d="M 18.5 5 C 15.467 5 13 7.467 13 10.5 L 13 32.5 C 13 35.533 15.467 38 18.5 38 L 34.5 38 C 37.533 38 40 35.533 40 32.5 L 40 10.5 C 40 7.467 37.533 5 34.5 5 L 18.5 5 z M 11 10 L 9.78125 10.8125 C 8.66825 11.5545 8 12.803625 8 14.140625 L 8 33.5 C 8 38.747 12.253 43 17.5 43 L 30.859375 43 C 32.197375 43 33.4465 42.33175 34.1875 41.21875 L 35 40 L 17.5 40 C 13.91 40 11 37.09 11 33.5 L 11 10 z"></path>
          </svg>
          <span class="tooltip">Copiar Protocolo pra Area de Transferência</span>
        </button></p>

      </div>
    `;
  });
  htmlProtocolos += `</div>`;
}



    
    

const htmlCard = `
  <div class="card scroll-container bg-neutral text-neutral-content p-4 space-y-1
              max-h-40 overflow-auto pedido-card relative
              overflow-y-auto break-words w-full max-w-full">
              
      <!-- Menu Hambúrguer fixo -->
    <div id="menu-hamburgo" class="menu-botao sticky top-0 right-0 z-10 bg-neutral p-2 flex justify-end">
      <div class="dropdown dropdown-end">
        <label tabindex="0" class="btn btn-sm btn-ghost text-white">
          &#9776;
        </label>
        <ul tabindex="0"
            class="dropdown-content menu p-2 shadow bg-base-100 text-base-content rounded-box w-36">
          <li><a onclick="editarPedido(${indexAbsoluto})" class="text-blue-600">Editar</a></li>
          <li><a onclick="copiarPedido(${indexAbsoluto})" class="text-green-600">Copiar</a></li>
          <li><a onclick="excluirPedido(${indexAbsoluto})" class="text-red-600">Excluir</a></li>
        </ul>
      </div>
    </div>        
    <!-- Número do Pedido (Fixa só o menu, deixando esse normal) -->
    <p ><strong class="alterarCor">N.º Pedido:</strong> ${pedido.numeroPedido}</p>
    <p><strong>Data:</strong> ${dataFormatada}</p>
    <p><strong>Matrícula:</strong> ${pedido.matricula}</p>
    <p>
      <strong>Resultado da Ônus:</strong>
      <span class="${corOnus} font-bold">${pedido.resultadoOnus}</span>
    </p>
    <p><strong>N.º de Folhas:</strong> ${pedido.numFolhas}</p>
    <p><strong>N.º de Imagens:</strong> ${pedido.numImagens}</p>
    <p><strong>Tipo de Certidão:</strong> ${pedido.tipoCertidao}</p>
    ${textoCodigo}
    <p><strong>Participantes:</strong></p>
    ${htmlParticipantes}
    <p><strong>Protocolos:</strong></p>
    ${htmlProtocolos}
  </div>
`;

// Adiciona ao container
container.innerHTML += htmlCard;



  });
}



/*******************************************
 * Paginação: "Anterior" e "Próximo"
 *******************************************/
function paginaAnterior() {
  if (paginaAtual > 1) {
    paginaAtual--;
    renderListaPedidos();
  }
}
function paginaProxima() {
  const total = pedidos.length;
  const maxPaginas = Math.ceil(total / itensPorPagina);
  if (paginaAtual < maxPaginas) {
    paginaAtual++;
    renderListaPedidos();
  }
}

/*******************************************
 * Variáveis que controlam se estamos editando
 *******************************************/
let editandoPedidoIndex = null; // índice no array local `pedidos[]`
let editandoPedidoId = null;    // ID real do pedido no banco de dados

/*******************************************
 * Função para Editar um Pedido
 * - Chamado ao clicar em "Editar" no card
 *******************************************/

function editarPedido(index) {
  const pedido = pedidos[index];
  if (!pedido) {
    alert("Pedido não encontrado!");
    return;
  }

  // Guardamos índice e ID do pedido no banco
  editandoPedidoIndex = index;
  editandoPedidoId = pedido.id; // ID real do BD

  // Ajusta títulos do formulário
  let tituloForm = document.getElementById("tituloFormPedido");
  if (tituloForm) {
      tituloForm.textContent = "Edição de Pedido";
      console.log(document.getElementById("tituloFormPedido"));

  } else {
      console.warn("Elemento 'tituloFormPedido' não encontrado.");
  }
  
  
  let btnCadastrar = document.getElementById("btnCadastrarPedido");
  if (btnCadastrar) {
      btnCadastrar.textContent = "Confirmar Alteração";
  }
  
  let tituloPrincipal = document.getElementById("tituloPrincipal");
  if (tituloPrincipal) {
      tituloPrincipal.textContent = "Edição de Pedido";
  }
  


  let data = new Date();
let dataFormatada = data.toISOString().split("T")[0];



  // Preenche campos do formulário
  document.getElementById("numeroPedido").value = pedido.numeroPedido || "";
  document.getElementById("dataPedido").value = dataFormatada || "";
  document.getElementById("matricula").value = pedido.matricula || "";
  document.getElementById("resultadoOnus").value = pedido.resultadoOnus || "NEGATIVA";
  document.getElementById("numFolhas").value = pedido.numFolhas || "";
  document.getElementById("numImagens").value = pedido.numImagens || "";
  document.getElementById("tipoCertidao").value = pedido.tipoCertidao || "BALCÃO";
  document.getElementById("inputCodigoCertidao").value = pedido.codigoCertidao || "";

  // Exibir ou ocultar campo de CÓDIGO ARIRJ/E-CARTÓRIO
  exibirCampoCodigoSeNecessario();

  // Preenche arrays temporários com participantes/protocolos
  participantesTemp = pedido.participantes ? [...pedido.participantes] : [];
  protocolosTemp = pedido.protocolos ? [...pedido.protocolos] : [];
}
/*******************************************
 * Função para Cadastrar OU Alterar Pedido
 * - Se não estamos editando, cria novo (POST)
 * - Se estamos editando, faz PUT /pedidos/:id
 *******************************************/
function cadastrarOuAlterarPedido() {
  const form = document.getElementById("form-pedido");
  const dataForm = new FormData(form);

  // Monta objeto do pedido a enviar
  const payload = {
    numeroPedido: dataForm.get("numeroPedido"),
    data: dataForm.get("data"),  // "YYYY-MM-DD"
    matricula: dataForm.get("matricula"),
    resultadoOnus: dataForm.get("resultadoOnus"),
    numFolhas: dataForm.get("numFolhas"),
    numImagens: dataForm.get("numImagens"),
    tipoCertidao: dataForm.get("tipoCertidao"),
    codigoCertidao: dataForm.get("codigoCertidao") || "",
    participantes: [...participantesTemp],
    protocolos: [...protocolosTemp],
  };

  // Se não estamos em modo de edição, faz POST
  if (editandoPedidoIndex === null) {
    // Criar novo (POST)
    fetch(`${API_URL}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao criar pedido");
        return res.json();
      })
      .then((dados) => {
        console.log("Pedido cadastrado:", dados);
        alert(dados.message || "Pedido criado com sucesso!");
        // Limpa form
        limparPedidoForm();
        // Recarrega lista do servidor
        listarPedidosDoServidor();
      })
      .catch((err) => {
        console.error(err);
        alert("Falha ao criar pedido no servidor.");
      });
  } else {
    // Se estamos editando => PUT
    if (!editandoPedidoId) {
      alert("Não foi possível identificar o pedido para editar (ID ausente).");
      return;
    }

    fetch(`${API_URL}/pedidos/${editandoPedidoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao editar pedido");
        return res.json();
      })
      .then((dados) => {
        console.log("Pedido editado:", dados);
        alert(dados.message || "Pedido alterado com sucesso!");
        // Limpa formulário
        limparPedidoForm();

        // Volta para modo novo
        editandoPedidoIndex = null;
        editandoPedidoId = null;
        document.getElementById("tituloFormPedido").textContent = "Novo Pedido";
        document.getElementById("btnCadastrarPedido").textContent = "Cadastrar";
        document.getElementById("tituloPrincipal").textContent = "Sistema de Pedidos";

        // Atualiza lista
        listarPedidosDoServidor();
      })
      .catch((err) => {
        console.error(err);
        alert("Falha ao editar pedido no servidor.");
      });
  }
}




function excluirPedido(index) {
  // Exclusão apenas local
  pedidos.splice(index, 1);
  renderListaPedidos();
  // Se quiser excluir no BD, seria um fetch DELETE, mas precisa rota /pedidos/:id
}

function copiarPedido(index) {
  const pedido = pedidos[index];
  let texto = `
N.º Pedido: ${pedido.numeroPedido}
Data: ${formataDataBR(pedido.data)}
N.º Matrícula: ${pedido.matricula}
Resultado da Ônus: ${pedido.resultadoOnus}
N.º de Folhas: ${pedido.numFolhas}
N.º de Imagens: ${pedido.numImagens}
Tipo de Certidão: ${pedido.tipoCertidao}
`;

  if (pedido.tipoCertidao === "ARIRJ") {
    texto += `CÓDIGO ARIRJ: ${pedido.codigoCertidao}\n`;
  } else if (pedido.tipoCertidao === "E-CARTÓRIO") {
    texto += `CÓDIGO E-CARTÓRIO: ${pedido.codigoCertidao}\n`;
  }

  texto += "Participantes:\n";
  if (!pedido.participantes || pedido.participantes.length === 0) {
    texto += "  Nenhum participante\n";
  } else {
    pedido.participantes.forEach((p) => {
      const orgaoFinal =
        p.orgaoEmissorSelect === "OUTRO" ? p.orgaoEmissorOutro : p.orgaoEmissorSelect;
      if (p.tipoDocumento === "CPF") {
        texto += `  ${p.qualificacao} - ${p.nome} - ${p.cpf} - ${p.genero} - ${p.identidade} - ${orgaoFinal} - ${p.estadoCivil}\n`;
      } else {
        texto += `  ${p.qualificacao} - ${p.nome} - ${p.cnpj}\n`;
      }
    });
  }

  texto += "Protocolos:\n";
  if (!pedido.protocolos || pedido.protocolos.length === 0) {
    texto += "  Nenhum protocolo\n";
  } else {
    pedido.protocolos.forEach((prot) => {
      texto += `  ${prot}\n`;
    });
  }

  navigator.clipboard.writeText(texto.trim()).then(() => {
    alert("Pedido copiado para a área de transferência!", "info");
  });
}

/*******************************************
 * 5. Participantes (TEMP)
 *******************************************/
function limparFormularioParticipante() {
  document.getElementById("part-qualificacao").value = "PROPRIETÁRIO";
  document.getElementById("part-nome").value = "";
  document.getElementById("tipoDocumento").value = "CPF";
  document.getElementById("inputCPF").value = "";
  document.getElementById("inputCNPJ").value = "";
  document.getElementById("part-genero").value = "MASCULINO";
  document.getElementById("part-identidade").value = "";
  document.getElementById("orgaoEmissorSelect").value = "DETRAN/RJ";
  document.getElementById("orgaoEmissorOutro").value = "";
  document.getElementById("part-estadoCivil").value = "SOLTEIRO";

  docTypeAnterior = "CPF"; // reset doc type
  handleTipoDocumentoChange();
  handleOrgaoEmissor();
}

function confirmarParticipante() {
  const p = {
    qualificacao: document.getElementById("part-qualificacao").value,
    nome: document.getElementById("part-nome").value,
    tipoDocumento: document.getElementById("tipoDocumento").value,
    cpf: document.getElementById("inputCPF").value,
    cnpj: document.getElementById("inputCNPJ").value,
    genero: document.getElementById("part-genero").value,
    identidade: document.getElementById("part-identidade").value,
    orgaoEmissorSelect: document.getElementById("orgaoEmissorSelect").value,
    orgaoEmissorOutro: document.getElementById("orgaoEmissorOutro").value,
    estadoCivil: document.getElementById("part-estadoCivil").value,
  };

  if (editandoParticipanteIndex === null) {
    participantesTemp.push(p);
  } else {
    participantesTemp[editandoParticipanteIndex] = p;
    editandoParticipanteIndex = null;
  }

  fecharModal("modal-participante");
}

/*******************************************
 * 6. Protocolos (TEMP)
 *******************************************/
function limparFormularioProtocolo() {
  document.getElementById("proto-observacao").value = "";
}

function confirmarProtocolo() {
  const texto = document.getElementById("proto-observacao").value;
  if (!texto.trim()) {
    alert("Preencha alguma observação para o protocolo.");
    return;
  }
  if (editandoProtocoloIndex === null) {
    protocolosTemp.push(texto);
  } else {
    protocolosTemp[editandoProtocoloIndex] = texto;
    editandoProtocoloIndex = null;
  }
  fecharModal("modal-protocolo");
}

/*******************************************
 * 7. Resumo de Participantes e Protocolos (Modal)
 *******************************************/
function renderizarResumoModal() {
  const ulPart = document.getElementById("lista-participantes");
  const ulProt = document.getElementById("lista-protocolos");

  ulPart.innerHTML = "";
  ulProt.innerHTML = "";

  // PARTICIPANTES
  if (participantesTemp.length === 0) {
    ulPart.innerHTML = "<li>Nenhum participante</li>";
  } else {
    participantesTemp.forEach((p, i) => {
      const orgaoFinal = p.orgaoEmissorSelect === "OUTRO" ? p.orgaoEmissorOutro : p.orgaoEmissorSelect;
      let str = "";
      if (p.tipoDocumento === "CPF") {
        str = `
          ${p.qualificacao} - ${p.nome} - ${p.cpf} - ${p.genero} - ${p.identidade} - ${orgaoFinal} - ${p.estadoCivil}
        `;
      } else {
        str = `${p.qualificacao} - ${p.nome} - ${p.cnpj}`;
      }
      ulPart.innerHTML += `
        <li>
          <div class="flex items-center justify-between gap-2">
            <span>${str}</span>
            <div>
              <button class="btn btn-xs btn-warning" onclick="editarParticipanteTemp(${i})">Editar</button>
              <button class="btn btn-xs btn-error" onclick="excluirParticipanteTemp(${i})">Excluir</button>
            </div>
          </div>
        </li>
      `;
    });
  }

  // PROTOCOLOS
  if (protocolosTemp.length === 0) {
    ulProt.innerHTML = "<li>Nenhum protocolo</li>";
  } else {
    protocolosTemp.forEach((texto, idx) => {
      ulProt.innerHTML += `
        <li>
          <div class="flex items-center justify-between gap-2">
            <span>${texto}</span>
            <div>
              <button class="btn btn-xs btn-warning" onclick="editarProtocoloTemp(${idx})">Editar</button>
              <button class="btn btn-xs btn-error" onclick="excluirProtocoloTemp(${idx})">Excluir</button>
            </div>
          </div>
        </li>
      `;
    });
  }
}

/*******************************************
 * Editar/Excluir Participante ou Protocolo (TEMP)
 *******************************************/
function editarParticipanteTemp(i) {
  editandoParticipanteIndex = i;
  const part = participantesTemp[i];
  abrirModal("modal-participante");
  document.getElementById("tituloModalParticipante").textContent = "Editar Participante";
  document.getElementById("btnConfirmarParticipante").textContent = "Confirmar Alteração";

  document.getElementById("part-qualificacao").value = part.qualificacao;
  document.getElementById("part-nome").value = part.nome;
  document.getElementById("tipoDocumento").value = part.tipoDocumento;
  document.getElementById("inputCPF").value = part.cpf;
  document.getElementById("inputCNPJ").value = part.cnpj;
  document.getElementById("part-genero").value = part.genero;
  document.getElementById("part-identidade").value = part.identidade;
  document.getElementById("orgaoEmissorSelect").value = part.orgaoEmissorSelect;
  document.getElementById("orgaoEmissorOutro").value = part.orgaoEmissorOutro;
  document.getElementById("part-estadoCivil").value = part.estadoCivil;

  docTypeAnterior = part.tipoDocumento;
  handleTipoDocumentoChange();
  handleOrgaoEmissor();
}

function excluirParticipanteTemp(i) {
  participantesTemp.splice(i, 1);
  renderizarResumoModal();
}

function editarProtocoloTemp(idx) {
  editandoProtocoloIndex = idx;
  abrirModal("modal-protocolo");
  document.getElementById("tituloModalProtocolo").textContent = "Editar Protocolo";
  document.getElementById("btnConfirmarProtocolo").textContent = "Confirmar Alteração";
  document.getElementById("proto-observacao").value = protocolosTemp[idx];
}

function excluirProtocoloTemp(i) {
  protocolosTemp.splice(i, 1);
  renderizarResumoModal();
}

/*******************************************
 * 8. Exibir/ocultar campo Código ARIRJ/E-CARTÓRIO
 *******************************************/
function exibirCampoCodigoSeNecessario() {
  const valor = document.getElementById("tipoCertidao").value;
  const divCodigo = document.getElementById("divCodigoCertidao");
  const labelCodigo = document.getElementById("labelCodigoCertidao");
  const inputCodigo = document.getElementById("inputCodigoCertidao");

  if (valor === "ARIRJ") {
    divCodigo.classList.remove("hidden");
    labelCodigo.innerText = "CÓDIGO ARIRJ";
    inputCodigo.placeholder = "Informe o código ARIRJ";
  } else if (valor === "E-CARTÓRIO") {
    divCodigo.classList.remove("hidden");
    labelCodigo.innerText = "CÓDIGO E-CARTÓRIO";
    inputCodigo.placeholder = "Informe o código E-CARTÓRIO";
  } else {
    divCodigo.classList.add("hidden");
    inputCodigo.value = "";
  }
}

/*******************************************
 * 9. Tipo Documento => resetar campos se trocar
 *******************************************/
function handleTipoDocumentoChange() {
  const valor = document.getElementById("tipoDocumento").value;
  const divCPF = document.getElementById("divCPF");
  const divCNPJ = document.getElementById("divCNPJ");
  const divGenero = document.getElementById("divGenero");
  const divIdentidade = document.getElementById("divIdentidade");
  const divOrgao = document.getElementById("divOrgaoEmissorSelect");
  const divOrgaoInput = document.getElementById("divOrgaoEmissorInput");
  const divEstadoCivil = document.getElementById("divEstadoCivil");

  if (valor !== docTypeAnterior) {
    // Zera campos se mudou de CPF para CNPJ ou vice-versa
    document.getElementById("inputCPF").value = "";
    document.getElementById("inputCNPJ").value = "";
    document.getElementById("part-identidade").value = "";
    document.getElementById("orgaoEmissorSelect").value = "DETRAN/RJ";
    document.getElementById("orgaoEmissorOutro").value = "";
    document.getElementById("part-estadoCivil").value = "SOLTEIRO";
    document.getElementById("part-genero").value = "MASCULINO";
  }
  docTypeAnterior = valor;

  if (valor === "CPF") {
    divCPF.classList.remove("hidden");
    divCNPJ.classList.add("hidden");
    divGenero.classList.remove("hidden");
    divIdentidade.classList.remove("hidden");
    divOrgao.classList.remove("hidden");
    if (document.getElementById("orgaoEmissorSelect").value === "OUTRO") {
      divOrgaoInput.classList.remove("hidden");
    } else {
      divOrgaoInput.classList.add("hidden");
    }
    divEstadoCivil.classList.remove("hidden");
  } else {
    // CNPJ
    divCNPJ.classList.remove("hidden");
    divCPF.classList.add("hidden");
    // Some extras
    divGenero.classList.add("hidden");
    divIdentidade.classList.add("hidden");
    divOrgao.classList.add("hidden");
    divOrgaoInput.classList.add("hidden");
    divEstadoCivil.classList.add("hidden");
  }
}

function handleOrgaoEmissor() {
  const val = document.getElementById("orgaoEmissorSelect").value;
  const divOrgaoInput = document.getElementById("divOrgaoEmissorInput");
  if (val === "OUTRO") {
    divOrgaoInput.classList.remove("hidden");
  } else {
    divOrgaoInput.classList.add("hidden");
    document.getElementById("orgaoEmissorOutro").value = "";
  }
}

/*******************************************
 * 10. Máscaras e validações
 *******************************************/
const numeroPedidoInput = document.getElementById("numeroPedido");
numeroPedidoInput.addEventListener("input", () => {
  numeroPedidoInput.value = numeroPedidoInput.value.replace(/\D/g, "");
});

const matriculaInput = document.getElementById("matricula");
matriculaInput.addEventListener("input", () => {
  matriculaInput.value = matriculaInput.value.replace(/\D/g, "");
});

const numFolhasInput = document.getElementById("numFolhas");
numFolhasInput.addEventListener("input", () => {
  numFolhasInput.value = numFolhasInput.value.replace(/\D/g, "");
});

const numImagensInput = document.getElementById("numImagens");
numImagensInput.addEventListener("input", () => {
  numImagensInput.value = numImagensInput.value.replace(/\D/g, "");
});

// Mascara CPF
const inputCPF = document.getElementById("inputCPF");
inputCPF.addEventListener("input", () => {
  let v = inputCPF.value.replace(/\D/g, "");
  v = v.substring(0, 11);
  let out = "";
  if (v.length > 3) {
    out = v.substring(0, 3) + ".";
    if (v.length > 6) {
      out += v.substring(3, 6) + ".";
      if (v.length > 9) {
        out += v.substring(6, 9) + "-";
        out += v.substring(9, 11);
      } else {
        out += v.substring(6);
      }
    } else {
      out += v.substring(3);
    }
  } else {
    out = v;
  }
  inputCPF.value = out;
});

// Mascara CNPJ
const inputCNPJ = document.getElementById("inputCNPJ");
inputCNPJ.addEventListener("input", () => {
  let v = inputCNPJ.value.replace(/\D/g, "");
  v = v.substring(0, 14);
  let out = "";
  if (v.length > 2) {
    out = v.substring(0, 2) + ".";
    if (v.length > 5) {
      out += v.substring(2, 5) + ".";
      if (v.length > 8) {
        out += v.substring(5, 8) + "/";
        if (v.length > 12) {
          out += v.substring(8, 12) + "-";
          out += v.substring(12, 14);
        } else {
          out += v.substring(8);
        }
      } else {
        out += v.substring(5);
      }
    } else {
      out += v.substring(2);
    }
  } else {
    out = v;
  }
  inputCNPJ.value = out;
});

/*******************************************
 * 11. Copiar Documento (CPF/CNPJ ou Protocolo)
 *******************************************/
function copiarDocumento(texto) {
  navigator.clipboard.writeText(texto).then(() => {
    alert(`Copiado: ${texto}`);
  });
}

/*******************************************
 * 12. Formatar data dd/mm/yyyy
 *******************************************/
function formataDataBR(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return "";
  const [yyyy, mm, dd] = yyyy_mm_dd.split("-");
  return `${dd}/${mm}/${yyyy}`;
}






function excluirPedido(index) {
  const pedido = pedidos[index];
  if (!pedido || !pedido.id) {
    alert("Pedido inválido.");
    return;
  }

  // Confirmar?
  if (!confirm("Tem certeza que deseja excluir este pedido?")) {
    return;
  }

  fetch(`${API_URL}/pedidos/${pedido.id}`, {
    method: "DELETE",
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error("Erro ao excluir pedido");
      }
      return res.json();
    })
    .then((dados) => {
      console.log(dados.message);
      // Agora recarrega a lista
      alert("Pedido excluído com sucesso!");

      listarPedidosDoServidor();
    })
    .catch((err) => {
      console.error(err);
      alert("Falha ao excluir pedido no servidor.");
    });
}

function logout() {
  showAlert("Você saiu!", "info");

  // Remove o token e impede que o usuário volte para a página sem login
  sessionStorage.removeItem("token");

  // Aguarda 1 segundo antes de redirecionar para garantir a execução correta
  setTimeout(() => {
      window.location.href = "login.html";
  }, 1000);
}


function atualizarUserGreeting() {
  const usuarioLogado = localStorage.getItem("usuarioLogado");
  const userGreeting = document.getElementById("userGreeting");

  if (usuarioLogado) {
      const nomeFormatado = formatarNome(usuarioLogado);
      userGreeting.textContent = `Olá, ${nomeFormatado}`;
      userGreeting.classList.remove("hidden");
  } else {
      userGreeting.classList.add("hidden"); // Esconde se não houver usuário logado
  }
}

// Formatar nome para primeira letra maiúscula em cada palavra
function formatarNome(nome) {
  return nome
      .toLowerCase()
      .split(" ")
      .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
      .join(" ");
}

document.addEventListener("DOMContentLoaded", () => {
  const token = sessionStorage.getItem("token");

  if (!token) {
      console.log("🔒 Nenhum token encontrado, redirecionando para login...");
      window.location.href = "login.html"; // Redireciona para login se não houver token
  } else {
      validarToken(token);
  }
});

// Função para validar o token no servidor
function validarToken(token) {
  fetch("https://main-project-1-6hja.onrender.com/validar-token", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` }
  })
  .then(response => {
      if (!response.ok) {
          throw new Error("Token inválido ou expirado");
      }
      return response.json();
  })
  .then(data => {
      console.log("✅ Token válido, usuário autenticado:", data.usuario);
  })
  .catch(error => {
      console.error("❌ Erro na autenticação:", error);

      // Remove token inválido e redireciona para login
      sessionStorage.removeItem("token");
      window.location.href = "login.html";
  });
}


        function toggleForms() {
            const loginForm = document.getElementById("loginForm");
            const registerForm = document.getElementById("registerForm");
            loginForm.classList.toggle("hidden");
            registerForm.classList.toggle("hidden");
        }

        function showAlert(message, type) {
            const alertContainer = document.getElementById("alertContainer");
            const alertDiv = document.createElement("div");
            alertDiv.className = `alert alert-${type} shadow-lg alert-animation`;
            alertDiv.innerHTML = `
                <span>${message}</span>
                <button class="btn btn-sm btn-circle btn-ghost" onclick="this.parentElement.remove()">✕</button>
            `;
            alertContainer.appendChild(alertDiv);

            // Remove automaticamente após 3 segundos
            setTimeout(() => alertDiv.remove(), 3000);
        }

        function login() {
    const user = document.getElementById("loginUser").value.trim();
    const pass = document.getElementById("loginPass").value.trim();

    fetch("https://main-project-1-6hja.onrender.com/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: user, senha: pass })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showAlert(data.error, "error");
        } else {
            showAlert("Login bem-sucedido!", "success");

            // Salva o token em sessionStorage (melhor que localStorage para segurança)
            sessionStorage.setItem("token", data.token);

            setTimeout(() => {
                window.location.href = "/index.html";
            }, 3000);
        }
    })
    .catch(error => {
        console.error("❌ Erro ao conectar:", error);
        showAlert("Erro ao conectar ao servidor!", "error");
    });
}




        function register() {
            const user = document.getElementById("registerUser").value.trim();
            const pass = document.getElementById("registerPass").value.trim();
            const confirmPass = document.getElementById("registerConfirmPass").value.trim();

            if (!user || !pass || !confirmPass) {
                showAlert("Preencha todos os campos!", "warning");
                return;
            }

            if (pass !== confirmPass) {
                showAlert("As senhas não coincidem!", "error");
                return;
            }

            showAlert(`Usuário ${user} registrado com sucesso!`, "success");
            setTimeout(() => toggleForms(), 3000);
        }

        function logout() {
    showAlert("Você saiu!", "info");
    sessionStorage.removeItem("token");
    setTimeout(() => window.location.href = "login.html", 1000);
}


        // Verifica se há usuário logado e exibe na navbar
        document.addEventListener("DOMContentLoaded", () => {
            const usuarioLogado = localStorage.getItem("usuarioLogado");
            if (usuarioLogado) {
                document.getElementById("userGreeting").textContent = `Olá, ${usuarioLogado}`;
                document.getElementById("userGreeting").classList.remove("hidden");
            }
        });


// Executa automaticamente ao carregar a página
document.addEventListener("DOMContentLoaded", atualizarUserGreeting);

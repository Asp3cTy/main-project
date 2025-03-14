// src/index.js - Cloudflare Worker principal

// Rotas da API
export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      
      // Servir arquivos estáticos
      if (path === '/' || path === '') {
        return await fetch(new URL('/dist/index.html', url.origin));
      }
      
      if (path.startsWith('/dist/')) {
        return await fetch(new URL(path, url.origin));
      }

      // Rotas da API
      if (path.startsWith('/api/')) {
        // Autenticação
        if (path === '/api/login') {
          return handleLogin(request, env);
        }
        if (path === '/api/register') {
          return handleRegister(request, env);
        }

        // Verificar autenticação para outras rotas da API
        const authorized = await isAuthorized(request, env);
        if (!authorized) {
          return new Response(JSON.stringify({ error: 'Não autorizado' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Rotas do sistema
        if (path === '/api/pedidos') {
          if (request.method === 'GET') {
            return handleGetPedidos(request, env);
          } else if (request.method === 'POST') {
            return handleCreatePedido(request, env);
          }
        }

        if (path.match(/\/api\/pedidos\/\d+$/)) {
          const id = path.split('/').pop();
          
          if (request.method === 'GET') {
            return handleGetPedido(id, env);
          } else if (request.method === 'PUT') {
            return handleUpdatePedido(id, request, env);
          } else if (request.method === 'DELETE') {
            return handleDeletePedido(id, env);
          }
        }

        // Rotas para participantes
        if (path === '/api/participantes') {
          if (request.method === 'POST') {
            return handleCreateParticipante(request, env);
          }
        }

        // Rotas para protocolos
        if (path === '/api/protocolos') {
          if (request.method === 'POST') {
            return handleCreateProtocolo(request, env);
          }
        }
        
        // Rota não encontrada
        return new Response(JSON.stringify({ error: 'Rota não encontrada' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Rota padrão - redirecionar para index.html
      return fetch(new URL('/dist/index.html', url.origin));
      
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

// Funções de autenticação
async function handleLogin(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { username, password } = await request.json();

    // Verificar credenciais
    const user = await env.DB.prepare(
      `SELECT id, username FROM users WHERE username = ? AND password = ?`
    ).bind(username, password).first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Credenciais inválidas' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Gerar token JWT (em produção use uma biblioteca adequada)
    const token = generateToken(user);

    return new Response(JSON.stringify({ token, user: { id: user.id, username: user.username } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleRegister(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { username, password } = await request.json();

    // Verificar se o usuário já existe
    const existingUser = await env.DB.prepare(
      `SELECT id FROM users WHERE username = ?`
    ).bind(username).first();

    if (existingUser) {
      return new Response(JSON.stringify({ error: 'Usuário já existe' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Criar novo usuário
    const result = await env.DB.prepare(
      `INSERT INTO users (username, password) VALUES (?, ?)`
    ).bind(username, password).run();

    if (!result.success) {
      throw new Error('Falha ao criar usuário');
    }

    return new Response(JSON.stringify({ message: 'Usuário criado com sucesso' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Função simples para verificar autenticação (em produção, use JWT adequadamente)
async function isAuthorized(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.split(' ')[1];
  // Em produção, valide o token JWT adequadamente
  try {
    // Simulação simples - em produção use verificação de JWT correta
    const payload = JSON.parse(atob(token.split('.')[1]));
    return !!payload.userId;
  } catch (e) {
    return false;
  }
}

// Função simples para gerar token (em produção, use uma biblioteca JWT adequada)
function generateToken(user) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ userId: user.id, username: user.username }));
  const signature = btoa('simulated-signature'); // Em produção, gere uma assinatura real
  
  return `${header}.${payload}.${signature}`;
}

// Manipuladores para Pedidos
async function handleGetPedidos(request, env) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;
  
  // Extrair o userId do token
  const authHeader = request.headers.get('Authorization');
  const token = authHeader.split(' ')[1];
  const payload = JSON.parse(atob(token.split('.')[1]));
  const userId = payload.userId;

  try {
    // Obter pedidos com contagem de participantes e protocolos
    const pedidos = await env.DB.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM participantes WHERE pedido_id = p.id) AS participantes_count,
        (SELECT COUNT(*) FROM protocolos WHERE pedido_id = p.id) AS protocolos_count
      FROM pedidos p
      WHERE p.usuario_id = ?
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();

    const totalCount = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM pedidos WHERE usuario_id = ?`
    ).bind(userId).first();

    return new Response(JSON.stringify({
      pedidos: pedidos.results || [],
      pagination: {
        total: totalCount ? totalCount.count : 0,
        page,
        limit
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleCreatePedido(request, env) {
  try {
    const pedidoData = await request.json();
    const { participantes = [], protocolos = [], ...pedido } = pedidoData;

    // Extrair o userId do token
    const authHeader = request.headers.get('Authorization');
    const token = authHeader.split(' ')[1];
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.userId;

    // Inserir pedido
    const result = await env.DB.prepare(`
      INSERT INTO pedidos (
        numeroPedido, dataPedido, matricula, resultadoOnus, 
        numFolhas, numImagens, tipoCertidao, codigoCertidao, usuario_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      pedido.numeroPedido,
      pedido.dataPedido,
      pedido.matricula,
      pedido.resultadoOnus,
      pedido.numFolhas,
      pedido.numImagens,
      pedido.tipoCertidao,
      pedido.codigoCertidao,
      userId
    ).run();

    if (!result.success) {
      throw new Error('Falha ao criar pedido');
    }

    const pedidoId = result.meta.last_row_id;

    // Inserir participantes
    for (const participante of participantes) {
      await env.DB.prepare(`
        INSERT INTO participantes (
          pedido_id, qualificacao, nome, tipoDocumento,
          cpf, cnpj, genero, identidade, orgaoEmissor, estadoCivil
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        pedidoId,
        participante.qualificacao,
        participante.nome,
        participante.tipoDocumento,
        participante.cpf,
        participante.cnpj,
        participante.genero,
        participante.identidade,
        participante.orgaoEmissor,
        participante.estadoCivil
      ).run();
    }

    // Inserir protocolos
    for (const protocolo of protocolos) {
      await env.DB.prepare(`
        INSERT INTO protocolos (pedido_id, observacao)
        VALUES (?, ?)
      `).bind(pedidoId, protocolo.observacao).run();
    }

    return new Response(JSON.stringify({ 
      message: 'Pedido criado com sucesso',
      pedidoId 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleGetPedido(id, env) {
  try {
    const pedido = await env.DB.prepare(
      `SELECT * FROM pedidos WHERE id = ?`
    ).bind(id).first();

    if (!pedido) {
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obter participantes
    const participantes = await env.DB.prepare(
      `SELECT * FROM participantes WHERE pedido_id = ?`
    ).bind(id).all();

    // Obter protocolos
    const protocolos = await env.DB.prepare(
      `SELECT * FROM protocolos WHERE pedido_id = ?`
    ).bind(id).all();

    return new Response(JSON.stringify({
      pedido,
      participantes: participantes.results || [],
      protocolos: protocolos.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleUpdatePedido(id, request, env) {
  try {
    const { participantes = [], protocolos = [], ...pedido } = await request.json();

    // Atualizar pedido
    const updateResult = await env.DB.prepare(`
      UPDATE pedidos SET
        numeroPedido = ?,
        dataPedido = ?,
        matricula = ?,
        resultadoOnus = ?,
        numFolhas = ?,
        numImagens = ?,
        tipoCertidao = ?,
        codigoCertidao = ?
      WHERE id = ?
    `).bind(
      pedido.numeroPedido,
      pedido.dataPedido,
      pedido.matricula,
      pedido.resultadoOnus,
      pedido.numFolhas,
      pedido.numImagens,
      pedido.tipoCertidao,
      pedido.codigoCertidao,
      id
    ).run();

    if (!updateResult.success) {
      throw new Error('Falha ao atualizar pedido');
    }

    // Apagar participantes e protocolos antigos
    await env.DB.prepare(`DELETE FROM participantes WHERE pedido_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM protocolos WHERE pedido_id = ?`).bind(id).run();

    // Inserir novos participantes
    for (const participante of participantes) {
      await env.DB.prepare(`
        INSERT INTO participantes (
          pedido_id, qualificacao, nome, tipoDocumento,
          cpf, cnpj, genero, identidade, orgaoEmissor, estadoCivil
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        participante.qualificacao,
        participante.nome,
        participante.tipoDocumento,
        participante.cpf,
        participante.cnpj,
        participante.genero,
        participante.identidade,
        participante.orgaoEmissor,
        participante.estadoCivil
      ).run();
    }

    // Inserir novos protocolos
    for (const protocolo of protocolos) {
      await env.DB.prepare(`
        INSERT INTO protocolos (pedido_id, observacao)
        VALUES (?, ?)
      `).bind(id, protocolo.observacao).run();
    }

    return new Response(JSON.stringify({ 
      message: 'Pedido atualizado com sucesso'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleDeletePedido(id, env) {
  try {
    // Excluir o pedido (as chaves estrangeiras CASCADE excluirão os relacionamentos)
    const result = await env.DB.prepare(
      `DELETE FROM pedidos WHERE id = ?`
    ).bind(id).run();

    if (!result.success) {
      throw new Error('Falha ao excluir pedido');
    }

    return new Response(JSON.stringify({ 
      message: 'Pedido excluído com sucesso'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Manipuladores para Participantes e Protocolos independentes
async function handleCreateParticipante(request, env) {
  try {
    const { pedidoId, ...participante } = await request.json();
    
    const result = await env.DB.prepare(`
      INSERT INTO participantes (
        pedido_id, qualificacao, nome, tipoDocumento,
        cpf, cnpj, genero, identidade, orgaoEmissor, estadoCivil
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      pedidoId,
      participante.qualificacao,
      participante.nome,
      participante.tipoDocumento,
      participante.cpf,
      participante.cnpj,
      participante.genero,
      participante.identidade,
      participante.orgaoEmissor,
      participante.estadoCivil
    ).run();

    if (!result.success) {
      throw new Error('Falha ao criar participante');
    }

    const participanteId = result.meta.last_row_id;

    return new Response(JSON.stringify({ 
      message: 'Participante criado com sucesso',
      participanteId 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleCreateProtocolo(request, env) {
  try {
    const { pedidoId, observacao } = await request.json();
    
    const result = await env.DB.prepare(`
      INSERT INTO protocolos (pedido_id, observacao)
      VALUES (?, ?)
    `).bind(pedidoId, observacao).run();

    if (!result.success) {
      throw new Error('Falha ao criar protocolo');
    }

    const protocoloId = result.meta.last_row_id;

    return new Response(JSON.stringify({ 
      message: 'Protocolo criado com sucesso',
      protocoloId 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

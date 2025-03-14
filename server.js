const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcrypt"); // Para criptografar senhas
const jwt = require("jsonwebtoken"); // Para autenticação JWT
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados SQLite3:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite3.');
        
        // Inicializar as tabelas
        initDB();
    }
});

// Função para inicializar o banco de dados
function initDB() {
    // SQL para criar tabelas se não existirem
    const createTableUsuarios = `
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            usuario TEXT NOT NULL UNIQUE,
            senha_hash TEXT NOT NULL
        )
    `;
    
    const createTablePedidos = `
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero_pedido TEXT NOT NULL,
            data_pedido TEXT NOT NULL,
            matricula TEXT NOT NULL,
            resultado_onus TEXT,
            num_folhas INTEGER,
            num_imagens INTEGER,
            tipo_certidao TEXT,
            codigo_certidao TEXT
        )
    `;
    
    const createTableParticipantes = `
        CREATE TABLE IF NOT EXISTS participantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL,
            qualificacao TEXT,
            nome TEXT NOT NULL,
            tipo_documento TEXT,
            cpf TEXT,
            cnpj TEXT,
            genero TEXT,
            identidade TEXT,
            orgao_emissor_select TEXT,
            orgao_emissor_outro TEXT,
            estado_civil TEXT,
            FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
        )
    `;
    
    const createTableProtocolos = `
        CREATE TABLE IF NOT EXISTS protocolos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL,
            observacao TEXT,
            FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
        )
    `;
    
    // Executar as queries para criar as tabelas
    db.serialize(() => {
        db.run(createTableUsuarios, (err) => {
            if (err) console.error('Erro ao criar tabela usuarios:', err.message);
            else console.log('Tabela usuarios verificada/criada com sucesso');
        });
        
        db.run(createTablePedidos, (err) => {
            if (err) console.error('Erro ao criar tabela pedidos:', err.message);
            else console.log('Tabela pedidos verificada/criada com sucesso');
        });
        
        db.run(createTableParticipantes, (err) => {
            if (err) console.error('Erro ao criar tabela participantes:', err.message);
            else console.log('Tabela participantes verificada/criada com sucesso');
        });
        
        db.run(createTableProtocolos, (err) => {
            if (err) console.error('Erro ao criar tabela protocolos:', err.message);
            else console.log('Tabela protocolos verificada/criada com sucesso');
        });
    });
}

const app = express();

app.use(cors()); // Habilita CORS
app.use(bodyParser.json());

// Servir arquivos estáticos (HTML, CSS, JS) da pasta 'public'
app.use(express.static(path.join(__dirname, 'dist')));

// ------------------------------
// 1. Rotas para Login
// ------------------------------

// ------------------------------
// 1️⃣ ROTAS DE LOGIN E REGISTRO
// ------------------------------

const secretKey = "seuSegredoUltraSecreto"; // Troque por uma chave segura

// 1. Primeiro, habilitar FOREIGN KEYS no SQLite (adicionar após a conexão com o DB)
db.run("PRAGMA foreign_keys = ON;", (err) => {
  if (err) console.error("Erro ao habilitar foreign keys:", err.message);
  else console.log("Foreign keys habilitadas com sucesso");
});

// 2. Modificar a rota de registro para verificar se o usuário foi inserido
// Registro
app.post("/register", (req, res) => {
    const { nome, usuario, senha } = req.body;

    if (!nome || !usuario || !senha) {
        return res.status(400).json({ error: "Todos os campos são obrigatórios" });
    }

    const sql = "SELECT * FROM usuarios WHERE LOWER(usuario) = ?";
    db.get(sql, [usuario.toLowerCase()], async (err, row) => {
        if (err) {
            console.error("Erro ao verificar usuário:", err);
            return res.status(500).json({ error: "Erro no servidor" });
        }

        if (row) {
            return res.status(400).json({ error: "Usuário já existe" });
        }

        try {
            const senha_hash = await bcrypt.hash(senha, 10);
            const insertSql = `INSERT INTO usuarios (nome, usuario, senha_hash) VALUES (?, ?, ?)`;
            db.run(insertSql, [nome, usuario, senha_hash], function (err) {
                if (err) {
                    console.error("Erro ao inserir usuário:", err);
                    return res.status(500).json({ error: "Erro ao registrar usuário" });
                }

                db.get("SELECT * FROM usuarios WHERE id = ?", [this.lastID], (verifyErr, user) => {
                    if (verifyErr || !user) {
                        console.error("Erro ao verificar inserção:", verifyErr);
                        return res.status(500).json({ error: "Usuário registrado mas não foi possível verificar" });
                    }

                    console.log("Usuário registrado com sucesso:", { id: user.id, usuario: user.usuario });
                    return res.json({ 
                        message: "Usuário registrado com sucesso!",
                        usuario: user.usuario 
                    });
                });
            });
        } catch (hashError) {
            console.error("Erro ao criptografar senha:", hashError);
            return res.status(500).json({ error: "Erro ao processar senha" });
        }
    });
});

// Login
app.post("/login", (req, res) => {
    const { usuario, senha } = req.body;

    if (!usuario || !senha) {
        return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
    }

    console.log("Tentativa de login para usuário:", usuario);

    const sql = "SELECT * FROM usuarios WHERE LOWER(usuario) = ?";
    db.get(sql, [usuario.toLowerCase()], async (err, user) => {
        if (err) {
            console.error("Erro na consulta ao banco:", err);
            return res.status(500).json({ error: "Erro no servidor" });
        }

        if (!user) {
            console.log("Usuário não encontrado:", usuario);
            return res.status(401).json({ error: "Usuário não encontrado!" });
        }

        try {
            console.log("Usuário encontrado, verificando senha...");
            const senhaValida = await bcrypt.compare(senha, user.senha_hash);

            if (!senhaValida) {
                console.log("Senha inválida para usuário:", usuario);
                return res.status(401).json({ error: "Senha inválida!" });
            }

            const token = jwt.sign(
                { id: user.id, usuario: user.usuario },
                secretKey,
                { expiresIn: "2h" }
            );

            console.log("Login bem-sucedido para usuário:", usuario);
            return res.json({ 
                message: "Login bem-sucedido!", 
                token,
                usuario: user.usuario
            });
        } catch (authError) {
            console.error("Erro no processo de autenticação:", authError);
            return res.status(500).json({ error: "Erro durante autenticação" });
        }
    });
});

// 4. Teste de conexão com o banco para verificar se as tabelas existem
app.get("/debug/check-tables", (req, res) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            return res.status(500).json({ error: "Erro ao verificar tabelas" });
        }
        
        // Verificar tabela de usuários
        db.all("PRAGMA table_info(usuarios)", (err, columns) => {
            if (err) {
                return res.status(500).json({ 
                    tables,
                    error: "Erro ao verificar estrutura da tabela de usuários" 
                });
            }
            
            return res.json({
                tables: tables.map(t => t.name),
                usuarios_columns: columns,
                message: "Verificação de banco concluída"
            });
        });
    });
});

app.post("/validar-token", (req, res) => {
    const token = req.headers["authorization"]?.split(" ")[1]; // Pega o token do cabeçalho

    if (!token) return res.status(401).json({ error: "Token não fornecido" });

    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Token inválido ou expirado" });

        return res.json({ usuario: decoded.usuario });
    });
});

// Middleware para verificar token JWT
function autenticarToken(req, res, next) {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).json({ error: "Acesso negado!" });

    jwt.verify(token.split(" ")[1], secretKey, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Token inválido!" });
        req.usuario = decoded;
        next();
    });
}

// ------------------------------
// 2️⃣ PROTEGENDO ROTAS
// ------------------------------

// Exemplo de rota protegida que só pode ser acessada com login válido
app.get("/usuario", autenticarToken, (req, res) => {
    return res.json({ message: `Olá, ${req.usuario.usuario}!`, usuario: req.usuario.usuario });
});

// ------------------------------
// 2. Rotas para PEDIDOS
// ------------------------------

// Criar um novo pedido
app.post("/pedidos", (req, res) => {
    const {
        numeroPedido,
        data,
        matricula,
        resultadoOnus,
        numFolhas,
        numImagens,
        tipoCertidao,
        codigoCertidao,
        participantes,
        protocolos
    } = req.body;

    // Insere o pedido
    const sqlPedido = `
        INSERT INTO pedidos 
        (numero_pedido, data_pedido, matricula, resultado_onus, 
         num_folhas, num_imagens, tipo_certidao, codigo_certidao)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(
        sqlPedido,
        [
            numeroPedido,
            data,
            matricula,
            resultadoOnus,
            numFolhas,
            numImagens,
            tipoCertidao,
            codigoCertidao || null,
        ],
        function (err) {
            if (err) {
                console.error("Erro ao inserir pedido:", err);
                return res.status(500).json({ error: "Erro no servidor" });
            }

            const pedidoId = this.lastID; // ID do pedido recém-criado

            // Se vierem participantes e protocolos, vamos inseri-los
            // OBS: Isso é opcional. Se não vier nada, arrays estarão vazios.

            // 1) PARTICIPANTES
            if (participantes && participantes.length > 0) {
                const sqlParticipantes = `
                    INSERT INTO participantes 
                    (pedido_id, qualificacao, nome, tipo_documento, cpf, cnpj, genero, 
                     identidade, orgao_emissor_select, orgao_emissor_outro, estado_civil)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                participantes.forEach(p => {
                    db.run(sqlParticipantes, [
                        pedidoId,
                        p.qualificacao,
                        p.nome,
                        p.tipoDocumento,
                        p.cpf || null,
                        p.cnpj || null,
                        p.genero || null,
                        p.identidade || null,
                        p.orgaoEmissorSelect || null,
                        p.orgaoEmissorOutro || null,
                        p.estadoCivil || null
                    ], (err2) => {
                        if (err2) {
                            console.error("Erro ao inserir participantes:", err2);
                            // Em um mundo ideal, você poderia usar transações
                            // e dar rollback se quisesse. Aqui só vamos logar.
                        }
                    });
                });
            }

            // 2) PROTOCOLOS
            if (protocolos && protocolos.length > 0) {
                const sqlProtocolos = `
                    INSERT INTO protocolos (pedido_id, observacao)
                    VALUES (?, ?)
                `;
                protocolos.forEach(obs => {
                    db.run(sqlProtocolos, [pedidoId, obs], (err3) => {
                        if (err3) {
                            console.error("Erro ao inserir protocolos:", err3);
                        }
                    });
                });
            }

            // Por fim, retornamos resposta
            return res.json({
                message: "Pedido inserido com sucesso (com participantes/protocolos)",
                pedidoId: pedidoId
            });
        }
    );
});

// Listar todos os pedidos
app.get("/pedidos", (req, res) => {
    // 1) Ler todos os pedidos
    const sqlPedidos = "SELECT * FROM pedidos ORDER BY numero_pedido DESC";
    db.all(sqlPedidos, (err, rowsPedidos) => {
        if (err) {
            console.error("Erro ao listar pedidos:", err);
            return res.status(500).json({ error: "Erro no servidor" });
        }
        if (rowsPedidos.length === 0) {
            // Se não há pedidos, retorne array vazio
            return res.json([]);
        }

        // Lista de IDs de pedidos
        const pedidoIds = rowsPedidos.map((p) => p.id);

        // 2) Buscar todos os participantes desses pedidos
        const sqlPart = "SELECT * FROM participantes WHERE pedido_id IN (?)";
        db.all(sqlPart, [pedidoIds], (errPart, rowsPart) => {
            if (errPart) {
                console.error("Erro ao buscar participantes:", errPart);
                return res.status(500).json({ error: "Erro no servidor" });
            }

            // 3) Buscar todos os protocolos desses pedidos
            const sqlProt = "SELECT * FROM protocolos WHERE pedido_id IN (?)";
            db.all(sqlProt, [pedidoIds], (errProt, rowsProt) => {
                if (errProt) {
                    console.error("Erro ao buscar protocolos:", errProt);
                    return res.status(500).json({ error: "Erro no servidor" });
                }

                // 4) Agora vamos montar um objeto { [idPedido]: { ...pedido..., participantes: [], protocolos: [] } }
                const pedidosMap = {};
                rowsPedidos.forEach((p) => {
                    pedidosMap[p.id] = {
                        id: p.id,
                        // Convertemos colunas underline -> camelCase
                        numeroPedido: p.numero_pedido,
                        data: p.data_pedido,
                        matricula: p.matricula,
                        resultadoOnus: p.resultado_onus,
                        numFolhas: p.num_folhas,
                        numImagens: p.num_imagens,
                        tipoCertidao: p.tipo_certidao,
                        codigoCertidao: p.codigo_certidao,
                        participantes: [],
                        protocolos: [],
                    };
                });

                // 5) Preencher participantes
                rowsPart.forEach((pp) => {
                    const pedidoId = pp.pedido_id;
                    const pedObj = pedidosMap[pedidoId];
                    if (!pedObj) return;
                    pedObj.participantes.push({
                        qualificacao: pp.qualificacao,
                        nome: pp.nome,
                        tipoDocumento: pp.tipo_documento,
                        cpf: pp.cpf,
                        cnpj: pp.cnpj,
                        genero: pp.genero,
                        identidade: pp.identidade,
                        orgaoEmissorSelect: pp.orgao_emissor_select,
                        orgaoEmissorOutro: pp.orgao_emissor_outro,
                        estadoCivil: pp.estado_civil,
                    });
                });

                // 6) Preencher protocolos
                rowsProt.forEach((pr) => {
                    const pedidoId = pr.pedido_id;
                    const pedObj = pedidosMap[pedidoId];
                    if (!pedObj) return;
                    pedObj.protocolos.push(pr.observacao);
                });

                // 7) Retornamos como array
                const resultado = Object.values(pedidosMap); 
                return res.json(resultado);
            });
        });
    });
});

// ------------------------------
// 3. Rotas para PARTICIPANTES
// ------------------------------

// Criar participante atrelado a um pedido
app.post("/participantes", (req, res) => {
    const {
        pedido_id,
        qualificacao,
        nome,
        tipo_documento,
        cpf,
        cnpj,
        genero,
        identidade,
        orgao_emissor_select,
        orgao_emissor_outro,
        estado_civil,
    } = req.body;

    const sql = `
        INSERT INTO participantes 
        (pedido_id, qualificacao, nome, tipo_documento, cpf, cnpj, genero,
         identidade, orgao_emissor_select, orgao_emissor_outro, estado_civil)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(
        sql,
        [
            pedido_id,
            qualificacao,
            nome,
            tipo_documento,
            cpf || null,
            cnpj || null,
            genero || null,
            identidade || null,
            orgao_emissor_select || null,
            orgao_emissor_outro || null,
            estado_civil || null,
        ],
        (err) => {
            if (err) {
                console.error("Erro ao inserir participante:", err);
                return res.status(500).json({ error: "Erro no servidor" });
            }
            return res.json({ message: "Participante inserido com sucesso" });
        }
    );
});

// Listar participantes de um pedido específico
app.get("/participantes/:pedidoId", (req, res) => {
    const { pedidoId } = req.params;
    const sql = "SELECT * FROM participantes WHERE pedido_id = ?";
    db.all(sql, [pedidoId], (err, rows) => {
        if (err) {
            console.error("Erro ao buscar participantes:", err);
            return res.status(500).json({ error: "Erro no servidor" });
        }
        return res.json(rows);
    });
});

// ------------------------------
// 4. Rotas para PROTOCOLOS
// ------------------------------

// Criar protocolo
app.post("/protocolos", (req, res) => {
    const { pedido_id, observacao } = req.body;

    const sql = `
        INSERT INTO protocolos (pedido_id, observacao)
        VALUES (?, ?)
    `;
    db.run(sql, [pedido_id, observacao], (err) => {
        if (err) {
            console.error("Erro ao inserir protocolo:", err);
            return res.status(500).json({ error: "Erro no servidor" });
        }
        return res.json({ message: "Protocolo inserido com sucesso" });
    });
});

// Listar protocolos de um pedido
app.get("/protocolos/:pedidoId", (req, res) => {
    const { pedidoId } = req.params;
    const sql = "SELECT * FROM protocolos WHERE pedido_id = ?";
    db.all(sql, [pedidoId], (err, rows) => {
        if (err) {
            console.error("Erro ao buscar protocolos:", err);
            return res.status(500).json({ error: "Erro no servidor" });
        }
        return res.json(rows);
    });
});

// Excluir Pedido
app.delete("/pedidos/:id", (req, res) => {
    const { id } = req.params;

    // Primeiro vamos remover todos os PARTICIPANTES e PROTOCOLOS ligados a ele (ou usar ON DELETE CASCADE)
    const sqlDeleteParticipantes = "DELETE FROM participantes WHERE pedido_id = ?";
    db.run(sqlDeleteParticipantes, [id], (errPart) => {
        if (errPart) {
            console.error("Erro ao excluir participantes do pedido:", errPart);
            return res.status(500).json({ error: "Erro no servidor ao excluir participantes" });
        }

        const sqlDeleteProtocols = "DELETE FROM protocolos WHERE pedido_id = ?";
        db.run(sqlDeleteProtocols, [id], (errProt) => {
            if (errProt) {
                console.error("Erro ao excluir protocolos do pedido:", errProt);
                return res.status(500).json({ error: "Erro no servidor ao excluir protocolos" });
            }

            // Finalmente, remove o pedido
            const sqlDeletePedido = "DELETE FROM pedidos WHERE id = ?";
            db.run(sqlDeletePedido, [id], (errPed) => {
                if (errPed) {
                    console.error("Erro ao excluir pedido:", errPed);
                    return res.status(500).json({ error: "Erro no servidor ao excluir pedido" });
                }
                return res.json({ message: "Pedido excluído com sucesso" });
            });
        });
    });
});

// Atualizar (editar) um pedido existente
app.put("/pedidos/:id", (req, res) => {
    const { id } = req.params;
    const {
        numeroPedido,
        data,
        matricula,
        resultadoOnus,
        numFolhas,
        numImagens,
        tipoCertidao,
        codigoCertidao,
        participantes,
        protocolos
    } = req.body;

    // 1) Atualiza o registro na tabela pedidos
    const sqlUpdatePed = `
        UPDATE pedidos
        SET 
          numero_pedido = ?,
          data_pedido = ?,
          matricula = ?,
          resultado_onus = ?,
          num_folhas = ?,
          num_imagens = ?,
          tipo_certidao = ?,
          codigo_certidao = ?
        WHERE id = ?
    `;
    db.run(
        sqlUpdatePed,
        [
            numeroPedido,
            data,
            matricula,
            resultadoOnus,
            numFolhas,
            numImagens,
            tipoCertidao,
            codigoCertidao || null,
            id
        ],
        (err) => {
            if (err) {
                console.error("Erro ao atualizar pedido:", err);
                return res.status(500).json({ error: "Erro no servidor" });
            }

            // 2) Excluir participantes/ protocolos antigos e inserir de novo
            // (Ou, se quiser, atualizar 1 a 1, mas é mais simples remover e inserir.)
            db.run("DELETE FROM participantes WHERE pedido_id = ?", [id], (errPart) => {
                if (errPart) {
                    console.error("Erro ao remover participantes:", errPart);
                    return res.status(500).json({ error: "Erro ao remover participantes antigos" });
                }
                // Inserir novamente (se participantes existir)
                if (participantes && participantes.length > 0) {
                    const sqlPart = `
                        INSERT INTO participantes
                        (pedido_id, qualificacao, nome, tipo_documento, cpf, cnpj, genero,
                         identidade, orgao_emissor_select, orgao_emissor_outro, estado_civil)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    participantes.forEach(p => {
                        db.run(sqlPart, [
                            id,
                            p.qualificacao,
                            p.nome,
                            p.tipoDocumento,
                            p.cpf || null,
                            p.cnpj || null,
                            p.genero || null,
                            p.identidade || null,
                            p.orgaoEmissorSelect || null,
                            p.orgaoEmissorOutro || null,
                            p.estadoCivil || null
                        ], (err2) => {
                            if (err2) console.error("Erro ao inserir participantes (PUT):", err2);
                        });
                    });
                }

                // Protocolos
                db.run("DELETE FROM protocolos WHERE pedido_id = ?", [id], (errProt) => {
                    if (errProt) {
                        console.error("Erro ao remover protocolos:", errProt);
                        return res.status(500).json({ error: "Erro ao remover protocolos antigos" });
                    }
                    if (protocolos && protocolos.length > 0) {
                        const sqlProt = `
                            INSERT INTO protocolos (pedido_id, observacao)
                            VALUES (?, ?)
                        `;
                        protocolos.forEach(obs => {
                            db.run(sqlProt, [id, obs],                         (err3) => {
                            if (err3) console.error("Erro ao inserir protocolos (PUT):", err3);
                        });
                    });
                }

                return res.json({ message: "Pedido atualizado com sucesso!" });
            });
        });
    });
});

// ------------------------------
// 5. Iniciar servidor
// ------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

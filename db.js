// db.js
require('dotenv').config(); // Carrega as variáveis do .env
const { Pool } = require('@cloudflare/d1');

// Crie a pool de conexão
const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

// Exporta a pool para usar em outros módulos
module.exports = pool;

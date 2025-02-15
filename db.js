// db.js
require('dotenv').config(); // Carrega as variáveis do .env
const mysql = require("mysql2");

// Crie a pool de conexão (ou use createConnection se preferir)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

// Exporta a pool para usar em outros módulos
module.exports = pool;



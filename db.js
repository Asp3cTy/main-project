require('dotenv').config(); // Apenas para ambiente local

const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,  // Ajuste conforme necessário
    queueLimit: 0
});

module.exports = pool.promise(); // Se estiver usando async/await

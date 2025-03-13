// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Cria uma nova instância do banco de dados SQLite3
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados SQLite3:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite3.');
    }
});

// Exporta a instância do banco de dados para usar em outros módulos
module.exports = db;

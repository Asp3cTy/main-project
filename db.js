// db.js
const mysql = require("mysql2");

// Crie a pool de conexão (ou use createConnection se preferir)
const pool = mysql.createPool({
    host: "database-2.cfs2cmiaucif.sa-east-1.rds.amazonaws.com",
    user: "admin",
    password: "palmares",
    database: "app_db",

});

// Exporta a pool para usar em outros módulos
module.exports = pool;

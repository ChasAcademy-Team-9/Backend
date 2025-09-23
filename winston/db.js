const sql = require("mssql");

const config = {
    server: 'team9-server.database.windows.net',
    port: 1433,
    database: 'team9-database',
    user: 'youruser',
    password: 'yourpassword',
    options: {
        encrypt: true,
        enableArithAbort: true,
        trustServerCertificate: false
    }
};

async function insertLog(level, message, meta) {
    try {
        let pool = await sql.connect(config);
        await pool.request()
            .input("Level", sql.NVarChar, level)
            .input("Message", sql.NVarChar, message)
            .input("Timestamp", sql.DateTime, new Date())
            .query(
                "INSERT INTO Logs (Level, Message, Timestamp) VALUES (@Level, @Message, @Timestamp)"
            );
    } catch (err) {
        console.error("DB log error:", err);
    }
}

module.exports = { insertLog };

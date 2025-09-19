const Transport = require("winston-transport");
const sql = require("mssql");

class AzureSQLTransport extends Transport {
    constructor(opts) {
        super(opts);

        this.pool = new sql.ConnectionPool({
            user: opts.user,
            password: opts.password,
            server: opts.server,       // ex: "myserver.database.windows.net"
            database: opts.database,
            options: {
                encrypt: true,           // Viktigt för Azure
                enableArithAbort: true
            }
        });

        this.pool.connect()
            .then(() => console.log("Ansluten till Azure SQL Database"))
            .catch(err => console.error("SQL-anslutningsfel:", err));
    }

    log(info, callback) {
        setImmediate(() => this.emit("logged", info));

        const request = this.pool.request();
        request.input("level", sql.NVarChar, info.level);
        request.input("message", sql.NVarChar, info.message);
        request.input("timestamp", sql.DateTime, new Date());

        request.query(
            "INSERT INTO Logs (Level, Message, Timestamp) VALUES (@level, @message, @timestamp)"
        ).catch(err => console.error("SQL insert error:", err));

        callback();
    }
}

module.exports = AzureSQLTransport;

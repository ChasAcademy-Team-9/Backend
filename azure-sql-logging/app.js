const { createLogger, format, transports } = require("winston");
const AzureSQLTransport = require("./AzureSQLTransport");
require('dotenv').config();
const logger = createLogger({
    level: "info",
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new AzureSQLTransport({
            user: process.env.AZURE_SQL_USER,
            password: process.env.AZURE_SQL_PASSWORD,
            server: "team9-server.database.windows.net",
            database: "team9-database"
        }),
        new transports.Console()
    ]
});

// Testa loggning
logger.info("Detta är ett testmeddelande till Azure SQL!");
logger.error("Detta är ett felmeddelande");

import { createLogger, format, transports } from 'winston';
import fs from 'fs/promises';
import sql from 'mssql';

// Azure SQL konfiguration
const azureConfig = {
    server: 'team9-server.database.windows.net',
    database: 'team9-database',
    authentication: {
        type: 'azure-active-directory-password',
        options: {
            AZURE_SQL_USER=your-email@chasacademy.se,
            AZURE_SQL_PASSWORD=your-password-here,
            clientId: '2fd908ad-0664-4344-b9be-cd3e8b574c38',
            tenantId: 'common'
        }
    },
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

// Custom Winston Transport som försöker Azure SQL först, sedan fil
class FlexibleAzureTransport extends transports.File {
    constructor(opts = {}) {
        super({
            filename: opts.filename || 'azure-logs-backup.log',
            format: format.combine(
                format.timestamp(),
                format.json()
            )
        });

        this.azurePool = null;
        this.azureConnected = false;
        this.retryCount = 0;
        this.maxRetries = 3;

        this.initAzureConnection();
    }

    async initAzureConnection() {
        if (this.retryCount >= this.maxRetries) {
            console.log("🛑 Max Azure anslutningsförsök nådd, använder endast fil-loggning");
            return;
        }

        try {
            console.log(`🔄 Azure anslutningsförsök ${this.retryCount + 1}/${this.maxRetries}...`);
            this.azurePool = await sql.connect(azureConfig);
            this.azureConnected = true;
            console.log("✅ Azure SQL Winston Transport ansluten!");
        } catch (err) {
            console.log(`❌ Azure anslutning misslyckades: ${err.message || 'Okänt fel'}`);
            this.azureConnected = false;
            this.retryCount++;

            // Försök igen efter 5 sekunder
            if (this.retryCount < this.maxRetries) {
                setTimeout(() => this.initAzureConnection(), 5000);
            }
        }
    }

    log(info, callback) {
        // Försök Azure först
        if (this.azureConnected) {
            this.logToAzure(info)
                .then(() => {
                    console.log(`📝 [${info.level.toUpperCase()}] ${info.message} → Azure SQL`);
                    this.emit('logged', info);
                    callback();
                })
                .catch((err) => {
                    console.log(`⚠️ Azure log failed: ${err.message}, falling back to file`);
                    this.azureConnected = false;
                    this.logToFile(info, callback);
                });
        } else {
            // Fallback till fil
            this.logToFile(info, callback);
        }
    }

    async logToAzure(info) {
        const request = this.azurePool.request();
        request.input('level', sql.NVarChar, info.level);
        request.input('message', sql.NVarChar, info.message);
        request.input('timestamp', sql.DateTime, new Date(info.timestamp));

        await request.query(`
            INSERT INTO Logs (Level, Message, Timestamp) 
            VALUES (@level, @message, @timestamp)
        `);
    }

    logToFile(info, callback) {
        console.log(`💾 [${info.level.toUpperCase()}] ${info.message} → Backup fil`);
        super.log(info, callback);
    }

    async close() {
        if (this.azurePool && this.azureConnected) {
            await this.azurePool.close();
            console.log("🔌 Azure Transport stängd");
        }
        super.close();
    }
}

// Skapa Winston logger
const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
    ),
    transports: [
        new FlexibleAzureTransport({
            filename: 'azure-backup-logs.log'
        }),
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.simple(),
                format.printf(({ timestamp, level, message }) => {
                    return `${timestamp} [${level}]: ${message}`;
                })
            )
        })
    ]
});

// === TEST WINSTON LOGGER ===
console.log("🚀 Startar Winston Azure Logger...");

// Vänta lite för Azure anslutning
setTimeout(() => {
    console.log("\n📝 Testar Winston loggning...");

    logger.info("Winston logger startad", {
        system: "Azure Test",
        timestamp: new Date().toISOString()
    });

    logger.info("Testar info-nivå loggning", {
        testData: "Detta är test-data",
        userId: "john.collinder"
    });

    logger.warn("Detta är en varning", {
        warningType: "Lågt diskutrymme",
        severity: "medium"
    });

    logger.error("Detta är ett fel", {
        errorCode: "CONN_TIMEOUT",
        details: "API anslutning timeout efter 30s",
        stack: "Error stack trace would be here..."
    });

    logger.info("Winston test slutfört");

    // Stäng efter en stund
    setTimeout(async () => {
        console.log("\n🔄 Stänger Winston logger...");

        // Stäng Azure transport
        const azureTransport = logger.transports.find(t => t instanceof FlexibleAzureTransport);
        if (azureTransport) {
            await azureTransport.close();
        }

        console.log("🎉 Winston test slutfört!");
        process.exit(0);
    }, 3000);

}, 2000);

export default logger;

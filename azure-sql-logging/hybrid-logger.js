import sql from 'mssql';
import fs from 'fs/promises';

console.log("📝 Azure Logger - Hybrid Solution");
console.log("Försöker ansluta till Azure SQL, faller tillbaka på fil-loggning");

const config = {
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

class HybridLogger {
    constructor() {
        this.pool = null;
        this.isConnected = false;
        this.logFile = 'backup-logs.json';
        this.initializeConnection();
    }

    async initializeConnection() {
        console.log("🔄 Försöker ansluta till Azure SQL...");
        try {
            this.pool = await sql.connect(config);
            this.isConnected = true;
            console.log("✅ Azure SQL anslutning lyckades!");

            // Om vi har backup-loggar, försök skicka dem
            await this.processPendingLogs();
        } catch (err) {
            console.log("⚠️ Azure SQL anslutning misslyckades, använder fil-backup");
            console.log(`   Fel: ${err.message || 'Okänt fel'}`);
            this.isConnected = false;
        }
    }

    async log(level, message, metadata = {}) {
        const logEntry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            metadata
        };

        if (this.isConnected) {
            try {
                await this.logToDatabase(logEntry);
                console.log(`📝 [${level.toUpperCase()}] ${message} → Azure SQL`);
                return true;
            } catch (err) {
                console.log(`⚠️ Database log failed, falling back to file: ${err.message}`);
                this.isConnected = false;
            }
        }

        // Fallback: logga till fil
        await this.logToFile(logEntry);
        console.log(`💾 [${level.toUpperCase()}] ${message} → Backup fil`);
        return false;
    }

    async logToDatabase(logEntry) {
        const request = this.pool.request();
        request.input('level', sql.NVarChar, logEntry.level);
        request.input('message', sql.NVarChar, logEntry.message);
        request.input('timestamp', sql.DateTime, new Date(logEntry.timestamp));

        await request.query(`
            INSERT INTO Logs (Level, Message, Timestamp) 
            VALUES (@level, @message, @timestamp)
        `);
    }

    async logToFile(logEntry) {
        try {
            let logs = [];
            try {
                const fileContent = await fs.readFile(this.logFile, 'utf8');
                logs = JSON.parse(fileContent);
            } catch {
                // Fil finns inte eller är tom
            }

            logs.push(logEntry);
            await fs.writeFile(this.logFile, JSON.stringify(logs, null, 2));
        } catch (err) {
            console.error("❌ Kunde inte skriva till backup-fil:", err.message);
        }
    }

    async processPendingLogs() {
        if (!this.isConnected) return;

        try {
            const fileContent = await fs.readFile(this.logFile, 'utf8');
            const logs = JSON.parse(fileContent);

            if (logs.length > 0) {
                console.log(`📤 Skickar ${logs.length} backup-loggar till databas...`);

                for (const log of logs) {
                    try {
                        await this.logToDatabase(log);
                    } catch (err) {
                        console.log(`⚠️ Kunde inte skicka backup-logg: ${err.message}`);
                        return; // Sluta försöka om en misslyckas
                    }
                }

                // Rensa backup-fil efter framgångsrik överföring
                await fs.writeFile(this.logFile, '[]');
                console.log("✅ Alla backup-loggar skickade!");
            }
        } catch {
            // Ingen backup-fil att processa
        }
    }

    async showStats() {
        console.log("\n📊 LOGG-STATISTIK:");

        if (this.isConnected) {
            try {
                const result = await this.pool.request().query(`
                    SELECT 
                        COUNT(*) as totalLogs,
                        COUNT(CASE WHEN Level = 'info' THEN 1 END) as infoLogs,
                        COUNT(CASE WHEN Level = 'warn' THEN 1 END) as warnLogs,
                        COUNT(CASE WHEN Level = 'error' THEN 1 END) as errorLogs,
                        MAX(Timestamp) as latestLog
                    FROM Logs
                `);
                const stats = result.recordset[0];
                console.log(`🗃️ Azure SQL Database:`);
                console.log(`   Total loggar: ${stats.totalLogs}`);
                console.log(`   Info: ${stats.infoLogs}, Warn: ${stats.warnLogs}, Error: ${stats.errorLogs}`);
                console.log(`   Senaste: ${stats.latestLog || 'Ingen'}`);
            } catch (err) {
                console.log(`❌ Kunde inte hämta database-stats: ${err.message}`);
            }
        }

        // Visa backup-fil stats
        try {
            const fileContent = await fs.readFile(this.logFile, 'utf8');
            const logs = JSON.parse(fileContent);
            console.log(`💾 Backup-fil: ${logs.length} väntande loggar`);
        } catch {
            console.log(`💾 Backup-fil: Ingen backup-data`);
        }
    }

    async close() {
        if (this.pool && this.isConnected) {
            await this.pool.close();
            console.log("🔌 Databas-anslutning stängd");
        }
    }
}

// === TEST APPLIKATION ===
async function main() {
    const logger = new HybridLogger();

    // Vänta lite för anslutning
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Testa olika logg-nivåer
    await logger.log('info', 'Applikationen startad', { version: '1.0.0' });
    await logger.log('info', 'Anslutning etablerad');
    await logger.log('warn', 'Varning: Låg diskutrymme', { diskSpace: '15%' });
    await logger.log('error', 'Fel: Timeout på API-anrop', { endpoint: '/api/users', timeout: 5000 });
    await logger.log('info', 'Test-loggar skickade');

    // Visa statistik
    await logger.showStats();

    // Stäng
    setTimeout(async () => {
        await logger.close();
        console.log("\n🎉 Test slutfört!");
    }, 1000);
}

main().catch(console.error);

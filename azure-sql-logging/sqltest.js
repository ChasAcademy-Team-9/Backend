import sql from 'mssql';

const config = {
    server: 'team9-server.database.windows.net',
    port: 1433,
    database: 'team9-database',
    authentication: {
        type: 'azure-active-directory-password',
        options: {
            userName: 'john.collinder@chasacademy.se',
            password: '34xKM67LEHxqzpY',
            clientId: '2fd908ad-0664-4344-b9be-cd3e8b574c38', // Azure CLI client ID
            tenantId: 'common'
        }
    },
    options: {
        encrypt: true,
        enableArithAbort: true,
        trustServerCertificate: false
    }
}

/*
    //Use Azure VM Managed Identity to connect to the SQL database
    const config = {
        server: process.env["db_server"],
        port: process.env["db_port"],
        database: process.env["db_database"],
        authentication: {
            type: 'azure-active-directory-msi-vm'
        },
        options: {
            encrypt: true
        }
    }

    //Use Azure App Service Managed Identity to connect to the SQL database
    const config = {
        server: process.env["db_server"],
        port: process.env["db_port"],
        database: process.env["db_database"],
        authentication: {
            type: 'azure-active-directory-msi-app-service'
        },
        options: {
            encrypt: true
        }
    }
*/

console.log("Starting...");
connectAndQuery();

async function connectAndQuery() {
    try {
        var poolConnection = await sql.connect(config);

        console.log("✅ Ansluten till Azure SQL Database!");
        console.log("🧪 Testar enkel query...");

        // Enkel test-query som alltid fungerar
        var resultSet = await poolConnection.request().query(`
            SELECT 
                GETDATE() as CurrentTime,
                USER_NAME() as CurrentUser,
                DB_NAME() as DatabaseName,
                @@VERSION as SqlVersion
        `);

        console.log(`📊 ${resultSet.recordset.length} rows returned.`);

        // Visa resultatet
        resultSet.recordset.forEach(row => {
            console.log("🕐 Current Time:", row.CurrentTime);
            console.log("👤 Current User:", row.CurrentUser);
            console.log("🗃️ Database:", row.DatabaseName);
            console.log("🖥️ SQL Version:", row.SqlVersion.substring(0, 50) + "...");
        });

        // Testa om Logs-tabell finns
        console.log("\n🔍 Kontrollerar om Logs-tabell finns...");
        var tableCheck = await poolConnection.request().query(`
            SELECT COUNT(*) as tableExists 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'Logs'
        `);

        if (tableCheck.recordset[0].tableExists > 0) {
            console.log("✅ Logs-tabell finns!");

            // Visa eventuella loggar
            var logs = await poolConnection.request().query(`
                SELECT TOP 5 * FROM Logs ORDER BY Timestamp DESC
            `);
            console.log(`📝 ${logs.recordset.length} loggar i tabellen`);
        } else {
            console.log("⚠️ Logs-tabell finns inte - kör setup-database.sql först");
        }

        // close connection only when we're certain application is finished
        poolConnection.close();
        console.log("🔌 Anslutning stängd");
    } catch (err) {
        console.error("❌ Fel uppstod:");
        console.error("   Meddelande:", err.message);
        console.error("   Kod:", err.code);
        console.error("   Number:", err.number);
        console.error("   State:", err.state);

        if (err.originalError) {
            console.error("   Original error:", err.originalError.message);
        }
    }
}
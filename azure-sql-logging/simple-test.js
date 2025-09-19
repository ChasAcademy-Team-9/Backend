import sql from 'mssql';

console.log("🔍 Testar Azure SQL anslutning med olika metoder...");

// Metod 1: Försök med Azure AD Default (använder systemets inloggning)
const configDefault = {
    server: 'team9-server.database.windows.net',
    database: 'team9-database',
    authentication: {
        type: 'azure-active-directory-default'
    },
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

// Metod 2: Azure AD med användarnamn/lösenord (kräver korrekt tenant)
const configPassword = {
    server: 'team9-server.database.windows.net',
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
        trustServerCertificate: false
    }
};

async function testConnection(config, name) {
    console.log(`\n🧪 Testar: ${name}`);
    try {
        const pool = await sql.connect(config);
        console.log(`✅ ${name}: FRAMGÅNG!`);

        const result = await pool.request().query('SELECT GETDATE() as now, USER_NAME() as user');
        console.log(`📊 Resultat:`, result.recordset[0]);

        await pool.close();
        return true;
    } catch (err) {
        console.log(`❌ ${name}: MISSLYCKADES`);
        console.log(`   Error: ${err.message || 'Tom felmeddelande'}`);
        console.log(`   Code: ${err.code || 'Ingen kod'}`);
        return false;
    }
}

async function main() {
    console.log("👤 Använder: john.collinder@chasacademy.se");
    console.log("🏢 Server: team9-server.database.windows.net");
    console.log("🗃️ Database: team9-database");

    const test1 = await testConnection(configDefault, "Azure AD Default");
    const test2 = await testConnection(configPassword, "Azure AD Password");

    if (!test1 && !test2) {
        console.log("\n💡 Eftersom du kan logga in via Azure Portal Query Editor:");
        console.log("1. 🔥 Kontrollera att din IP är tillåten i Azure SQL firewall");
        console.log("2. 🔐 Kanske behöver du logga in med 'az login' först");
        console.log("3. 🏢 Tenant ID kanske behöver specificeras");
        console.log("4. ⚙️ Prova att använda Azure Portal Query Editor istället");
    }
}

main().catch(console.error);
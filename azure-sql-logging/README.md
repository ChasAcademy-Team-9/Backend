# Azure SQL Logging Module 📝

En robust logging-lösning för Azure SQL Database med automatisk backup-funktionalitet.

## 🚀 Features

- ✅ **Azure AD autentisering** - Stöd för Entra ID
- ✅ **Automatisk fallback** - Backup till fil om Azure SQL inte är tillgängligt  
- ✅ **Winston integration** - Professionell logging framework
- ✅ **Auto-sync** - Skickar backup-loggar när anslutning återställs

## 📁 Filer

- `winston-azure.js` - Huvudlösning med Winston integration
- `hybrid-logger.js` - Fristående hybrid logger
- `AzureSQLTransport.js` - Custom Winston transport
- `simple-test.js` - Anslutningstest
- `sqltest.js` - Detaljerade Azure SQL-tester
- `SOLUTION.md` - Felsökningsguide

## 🔧 Installation

```bash
cd azure-sql-logging
npm install
cp .env.example .env
# Redigera .env med dina Azure SQL credentials
```

## 🚀 Användning

### Winston Logger (Rekommenderat)
```bash
npm start
```

### Hybrid Logger
```bash
npm run hybrid
```

### Testa anslutning
```bash
npm test
```

## 🔒 Konfiguration

Skapa `.env` fil baserad på `.env.example`:
```env
AZURE_SQL_USER=your-email@chasacademy.se
AZURE_SQL_PASSWORD=your-password
```

## 📊 Backup-funktionalitet

- 💾 Automatisk backup till fil vid anslutningsproblem
- 🔄 Återförsök till Azure SQL regelbundet
- 📤 Automatisk sync av backup-loggar

Se `SOLUTION.md` för detaljerad felsökning.
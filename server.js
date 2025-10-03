// server.js
require('dotenv').config();
const express = require("express");
const sql = require("mssql");
const { error } = require('winston');
//const loginConfig = require("./config/loginConfig.js"); // er databas-konfiguration
const app = express();

// VIKTIGT: Azure tilldelar porten via miljövariabeln PORT
const port = process.env.PORT || 8080;

const loginConfig = {
  user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        enableArithAbort: true,
        trustServerCertificate: false
    },
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Singleton SQL pool
let pool;
const getPool = async () => {
  if (!pool) {
    pool = await sql.connect(loginConfig);
    console.log("✅ Ansluten till Azure SQL Database!");
  }
  return pool;
};

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "API körs!",
    status: "online",
    timestamp: new Date().toISOString(),
    
  });
});

// Hälsokontroll
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// API: Hämta alla rader i TestTabel
app.get("/api/items", async (req, res) => {
  try {
        const pool = await getPool();
        const result = await pool.request()
            .query('SELECT * FROM TestTable');
        res.json({ success: true, drivers: result.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch drivers', details: error.message });
    }
});
app.get('/api/drivers', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query('SELECT DriverID, FirstName, LastName, UserName FROM Drivers');
        res.json({ success: true, drivers: result.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch drivers', details: error.message });
    }
});

//Create User
app.post('/api/drivers/', async (req, res) => {
    try {
        const { FirstName, LastName, UserName, Password } = req.body;

        if (!FirstName || !LastName || !UserName || !Password) {
            return res.status(400).json({ error: 'All fields required: FirstName, LastName, UserName, Password' });
        }

        const pool = await getPool();
        const result = await pool.request()
            .input('FirstName', sql.NVarChar, FirstName)
            .input('LastName', sql.NVarChar, LastName)
            .input('UserName', sql.VarChar, UserName)
            .input('Password', sql.VarChar, Password)
            .query(`
                INSERT INTO Drivers (FirstName, LastName, UserName, Password)
                OUTPUT INSERTED.*
                VALUES (@FirstName, @LastName, @UserName, @Password);
            `);

        res.status(201).json({ success: true, driver: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create driver', details: error.message });
    }
});


// 404 hantering
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint hittades inte" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({ error: "Något gick fel!", details: err.message });
});

// Starta servern
app.listen(port, "0.0.0.0", () => {
  console.log(`Server körs på port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

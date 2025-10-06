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


//Create User
/*app.post('/api/register/', async (req, res) => {
  try {
    const { TableName, FirstName, LastName, UserName, Password } = req.body;

    if (!TableName || !FirstName || !LastName || !UserName || !Password) {
      return res.status(400).json({ error: 'All fields required: FirstName, LastName, UserName, Password' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('FirstName', sql.NVarChar, FirstName)
      .input('LastName', sql.NVarChar, LastName)
      .input('UserName', sql.VarChar, UserName)
      .input('Password', sql.VarChar, Password)
      .query(`
                INSERT INTO ${TableName} (FirstName, LastName, UserName, Password)
                OUTPUT INSERTED.*
                VALUES (@FirstName, @LastName, @UserName, @Password);
            `);

    res.status(201).json({ success: true, driver: result.recordset[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create driver', details: error.message });
  }
});*/

app.post('/api/register', async (req, res) => {
  try {
    const { TableName, FirstName, LastName, UserName, Password, Adress } = req.body;

    if (!TableName || !FirstName || !LastName || !UserName || !Password) {
      return res.status(400).json({
        error: 'Missing required fields: TableName, FirstName, LastName, UserName, Password'
      });
    }

    const pool = await getPool();
    const request = pool.request()
      .input('FirstName', sql.NVarChar, FirstName)
      .input('LastName', sql.NVarChar, LastName)
      .input('UserName', sql.VarChar, UserName)
      .input('Password', sql.VarChar, Password);

    let query;

    //  Add Adress only for Receivers
    if (TableName === 'Receivers') {
      if (!Adress) {
        return res.status(400).json({ error: 'Adress is required for Receivers' });
      }

      request.input('Adress', sql.NVarChar, Adress);

      query = `
        INSERT INTO Receivers (FirstName, LastName, UserName, Password, Adress)
        OUTPUT INSERTED.*
        VALUES (@FirstName, @LastName, @UserName, @Password, @Adress);
      `;
    } else {
      query = `
        INSERT INTO ${TableName} (FirstName, LastName, UserName, Password)
        OUTPUT INSERTED.*
        VALUES (@FirstName, @LastName, @UserName, @Password);
      `;
    }

    const result = await request.query(query);

    res.status(201).json({
      success: true,
      user: result.recordset[0],
      table: TableName
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to create user',
      details: error.message
    });
  }
});

// ========== GET /api/register ==========
// Query by Id or UserName (optional). If none given, list all in the table.
app.get('/api/register', async (req, res) => {
  try {
    const { TableName, Id, UserName } = req.query;

    if (!TableName) {
      return res.status(400).json({ error: 'Missing required query param: TableName' });
    }

    const pool = await getPool();
    const request = pool.request();

    let where = '';
    if (Id) {
      request.input('Id', sql.Int, Number(Id));
      where = 'WHERE Id = @Id';
    } else if (UserName) {
      request.input('UserName', sql.VarChar, UserName);
      where = 'WHERE UserName = @UserName';
    }

    const query = `
      SELECT *
      FROM ${TableName}
      ${where}
      ORDER BY Id DESC;
    `;

    const result = await request.query(query);
    res.json({ success: true, table: TableName, count: result.recordset.length, data: result.recordset });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch', details: error.message });
  }
});



// ========== PUT /api/register ==========
// Update by Id (preferred) or UserName; updates only provided fields.
// For Receivers you can also update Adress.
app.put('/api/register', async (req, res) => {
  try {
    const {
      TableName, Id, UserName,           // identify target (Id preferred)
      FirstName, LastName, NewUserName,  // updatable fields
      Password, Adress                   // Receivers-only Adress
    } = req.body;

    if (!TableName) {
      return res.status(400).json({ error: 'Missing required field: TableName' });
    }
    if (!Id && !UserName) {
      return res.status(400).json({ error: 'Provide Id or UserName to identify the record' });
    }

    const pool = await getPool();
    const request = pool.request();

    // WHERE clause
    let where = '';
    if (Id) {
      request.input('Id', sql.Int, Number(Id));
      where = 'WHERE Id = @Id';
    } else {
      request.input('UserName', sql.VarChar, UserName);
      where = 'WHERE UserName = @UserName';
    }

    // Build SET list only from provided fields
    const sets = [];
    if (FirstName !== undefined) { request.input('FirstName', sql.NVarChar, FirstName); sets.push('FirstName = @FirstName'); }
    if (LastName !== undefined) { request.input('LastName', sql.NVarChar, LastName); sets.push('LastName = @LastName'); }
    if (NewUserName !== undefined) { request.input('NewUserName', sql.VarChar, NewUserName); sets.push('UserName = @NewUserName'); }
    if (Password !== undefined) { request.input('Password', sql.VarChar, Password); sets.push('Password = @Password'); }

    if (TableName === 'Receivers' && Adress !== undefined) {
      request.input('Adress', sql.NVarChar, Adress);
      sets.push('Adress = @Adress');
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    const query = `
      UPDATE ${TableName}
      SET ${sets.join(', ')}
      ${where};

      SELECT TOP 1 * FROM ${TableName} ${where};
    `;

    const result = await request.query(query);
    const updated = result.recordset[0];
    if (!updated) return res.status(404).json({ error: 'Record not found' });

    res.json({ success: true, table: TableName, user: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update', details: error.message });
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

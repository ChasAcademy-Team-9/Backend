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
let TableName
let TableId

function TableExist(role){
    switch(role){
      case "driver":
        TableName = "Drivers"
        TableId = "DriverID"
        break;
      case "receiver":
        TableName = "Receivers"
        TableId = "ReceiverID"
      break;
      case "sender":
        TableName = "Senders"
        TableId = "SenderID"
      break;
      default: 
        return false
    }
    return true
}
async function UserExist(UserName){
  const pool = await getPool();

    // Kolla om användarnamnet redan finns
    const existingUser = await pool.request()
      .input('UserName', sql.VarChar, UserName)
      .query(`SELECT * FROM ${TableName} WHERE UserName = @UserName`);
    
    return existingUser.recordset.length > 0;
}

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
    const { Role, FirstName, LastName, UserName, Password, Adress } = req.body;

    //Check every input is requered
    if (!Role || !FirstName || !LastName || !UserName || !Password) {
      return res.status(400).json({ success: false, error: 'All fields required: FirstName, LastName, UserName, Password'});
    }

    //Check if the role have an existing table
    if(!TableExist(Role)){
      return res.status(400).json({ success: false, error: 'Role does not exist'});
    }

    //Check If user exist
    if(await UserExist(UserName)){
      return res.status(409).json({ success: false, error: 'User alredy exist'});
    }

    if(TableName != "Receivers"){
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

    return res.status(201).json({ success: true, driver: result.recordset});
    }
    if(!Adress){
      return res.status(400).json({ success: false, error: 'A adress is requred'});
    }
    const pool = await getPool();
    const result = await pool.request()
      .input('FirstName', sql.NVarChar, FirstName)
      .input('LastName', sql.NVarChar, LastName)
      .input('Adress', sql.NVarChar, Adress)
      .input('UserName', sql.VarChar, UserName)
      .input('Password', sql.VarChar, Password)
      .query(`
                INSERT INTO ${TableName} (FirstName, LastName, Adress, UserName, Password)
                OUTPUT INSERTED.*
                VALUES (@FirstName, @LastName, @Adress, @UserName, @Password);
            `);
    res.status(201).json({ success: true, driver: result.recordset });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create a user', details: error.message });
  }
});

app.delete('/api/register', async (req, res) => {
  try {
    const { Role, UserName, Id } = req.body;

    // 1️⃣ Kontrollera roll/tabell
    if (!TableExist(Role)) {
      return res.status(400).json({
        errorMessage: 'You need to choose a valid role: driver, receiver, or sender.'
      });
    }

    // 2️⃣ Kontrollera att något identifierande värde finns
    if (!UserName && !Id) {
      return res.status(400).json({
        errorMessage: 'You need to specify an identifier: UserName or Id.'
      });
    }

    // 3️⃣ Kolla att användaren finns
    if (!(await UserExist(UserName))) {
      return res.status(404).json({
        errorMessage: 'Cannot find an existing account.'
      });
    }

    // 4️⃣ Skapa databasanslutning
    const pool = await getPool();
    let result;

    // 5️⃣ Ta bort med ID om det finns
    if (Id != undefined) {
      result = await pool.request()
        .input('Id', sql.Int, Id)
        .query(`DELETE FROM ${TableName} WHERE ${TableId}=@Id`);
    } else {
      // 6️⃣ Ta bort med användarnamn (OBS: måste vara parameteriserad)
      result = await pool.request()
        .input('UserName', sql.VarChar, UserName)
        .query(`DELETE FROM ${TableName} WHERE UserName=@UserName`);
    }

    // 7️⃣ Om ingen rad togs bort → användaren fanns inte
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ errorMessage: 'User not found.' });
    }

    // 8️⃣ Klart
    res.status(200).json({
      success: true,
      message: `User deleted successfully from ${TableName}.`
    });

  } catch (err) {
    console.error('DELETE /api/register error:', err);
    res.status(500).json({ errorMessage: 'Internal server error.' });
  }
});


// ========== GET /api/register ==========
// Query by Id or UserName (optional). If none given, list all in the table.
app.get('/api/register', async (req, res) => {
  try {
    const { Role, UserName, Id} = req.body;
    if(! await checkTable(Role)){
      return res.status(500).json({ errorMessage: 'You need to chose in a role for driver, receiver, sender' });
    }
    if(UserName != undefined){
            const result = await pool.request()
      .query(`
                SELECT TOP (10) * FROM ${TableName}
                WHERE UserName='${UserName}'
            `);
      return res.status(201).json({ success: true, driver: result.recordset });
    }
    if(Id != undefined){
      const pool = await getPool();
      const result = await pool.request()
      .query(`
                SELECT TOP (10) * FROM ${TableName}
                WHERE ${TableId}=${Id}
            `);
    return res.status(201).json({ success: true, driver: result.recordset });
    }
    const result = await pool.request()
      .query(`
                SELECT TOP (100) * FROM ${TableName}
            `);      
    res.status(201).json({ success: true, driver: result.recordset });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create driver', details: error.message });
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

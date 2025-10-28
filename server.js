// server.js
require('dotenv').config();
const jwt = require('jsonwebtoken')
const express = require("express");
const sql = require("mssql");
const { error } = require('winston');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const app = express();
const cors = require('cors');
const { config } = require('dotenv');
const verifyToken = require('./config/authentication.js')

// Cors
app.use(cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect Swagger UI to /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Uses Azure port or else 8080
const port = process.env.PORT || 8080;

//Logins for azure sql server:
//Important: Fill in the .env file with login details
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

let TableName //Global Table Name for database
let TableId   //Using correct table ID for specifik TableName

//Check if table exsit by using keyword for driver, receiver and sender
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

//Check if user alredy exist
async function UserExist(UserName){
  const pool = await getPool();

    //Check if user exist in database by UserName
    const existingUser = await pool.request()
      .input('UserName', sql.VarChar, UserName)
      .query(`SELECT * FROM ${TableName} WHERE UserName = @UserName`);
    
    return existingUser.recordset.length > 0;
}

// Singleton SQL pool
let pool;
const getPool = async () => {
  if (!pool) {
    pool = await sql.connect(loginConfig);
    console.log("Ansluten till Azure SQL Database!");
  }
  return pool;
};

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "API is online, go to /api-docs for documentation",
    status: "online",
    timestamp: new Date().toISOString(),

  });
});

//Create new user
app.post('/api/register', async (req, res) => {
  try {
    const { Role, FirstName, LastName, UserName, Password } = req.body;

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
    res.status(201).json({ success: true, driver: result.recordset });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create a user', details: error.message });
  }
});

//Deletes a user a table
app.delete('/api/register', async (req, res) => {
  try {
    const { Role, UserName, Id } = req.body;

    //Check so the table alredy exist by role
    if (!TableExist(Role)) {
      return res.status(400).json({
        errorMessage: 'You need to choose a valid role: driver, receiver, or sender.'
      });
    }

    //Checks if mandatory values exists
    if (!UserName && !Id) {
      return res.status(400).json({
        errorMessage: 'You need to specify an identifier: UserName or Id.'
      });
    }

    //Checks if user exist
    if (!(await UserExist(UserName))) {
      return res.status(404).json({
        errorMessage: 'Cannot find an existing account.'
      });
    }

    //Connects to the database
    const pool = await getPool();
    let result;

    //Removes user if ID is defined
    if (Id != undefined) {
      result = await pool.request()
        .input('Id', sql.Int, Id)
        .query(`DELETE FROM ${TableName} WHERE ${TableId}=@Id`);
    } else {
      //Removes user by UserName
      result = await pool.request()
        .input('UserName', sql.VarChar, UserName)
        .query(`DELETE FROM ${TableName} WHERE UserName=@UserName`);
    }

    //If no row was affected display error message
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ errorMessage: 'User not found.' });
    }

  
    res.status(200).json({
      success: true,
      message: `User deleted successfully from ${TableName}.`
    });

  } catch (err) {
    console.error('DELETE /api/register error:', err);
    res.status(500).json({ errorMessage: 'Internal server error.' });
  }
});

//App login
app.post('/api/login', async (req, res) => {
  
const{ Role, UserName, Password} = req.body
  try {
if(!Role || !UserName || !Password){
      return res.status(400).json({error: "You need to put Role, UserName, Password"})
    }
    if(!TableExist(Role)){
      return res.status(400).json({error: "Role does not exist"})
    }
    if(!(await UserExist(UserName))){
      return res.status(400).json({error: "User does not exist"})
    }
    
    const result = await pool.request()
      .input('UserName', sql.VarChar, UserName)
      .input('Password', sql.VarChar, Password)
      .query(`SELECT * FROM ${TableName} WHERE UserName = @UserName`);

      if(!(result.recordset[0].Password === Password)){
        res.status(401).json({error: "Invalid password"})
      }
      const token = jwt.sign({ UserName: UserName, Role: Role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.status(200).json({ token: token, message: "You are logged in", UserName : UserName, Role : Role });
  } catch (error) {
    res.status(500).json({details: error.message})
  
  }
});

// ========== GET /api/register ==========
app.get('/api/register/drivers', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`SELECT TOP (100) * FROM Drivers`);

    res.status(200).json({ success: true, drivers: result.recordset });

  } catch (error) {
    console.error('GET /api/register/drivers error:', error);
    res.status(500).json({
      error: 'Failed to find any data',
      details: error.message
    });
  }
});

//Gets all users from senders
app.get('/api/register/senders', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`SELECT TOP (100) * FROM Senders`);

    res.status(200).json({ success: true, drivers: result.recordset });

  } catch (error) {
    console.error('GET /api/register/senders error:', error);
    res.status(500).json({
      error: 'Failed to find any data',
      details: error.message
    });
  }
});

//Gets all users from recivers
app.get('/api/register/receivers', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`SELECT TOP (100) * FROM Receivers`);

    res.status(200).json({ success: true, drivers: result.recordset });

  } catch (error) {
    console.error('GET /api/register/receivers error:', error);
    res.status(500).json({
      error: 'Failed to find any data',
      details: error.message
    });
  }
});

// ========== PUT /api/register ==========
// Update by Id (preferred) or UserName; updates only provided fields.
// For Receivers you can also update.
app.put('/api/register', async (req, res) => {
  try {
    const {
      TableName, Id, UserName,           // identify target (Id preferred)
      FirstName, LastName, NewUserName,  // updatable fields
      Password
    } = req.body;

    if (!TableName) {
      return res.status(400).json({ error: 'Missing required field: TableName' });
    }
    if (!Id && !UserName) {
      return res.status(400).json({ error: 'Provide Id or UserName to identify the record' });
    }

    const pool = await getPool();
    const request = pool.request();

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

//Shows all pacakges and every Username connected to it
app.get('/api/packages', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT p.*, 
                   d.FirstName + ' ' + d.LastName AS DriverName,
                   s.FirstName + ' ' + s.LastName AS SenderName,
                   r.FirstName + ' ' + r.LastName AS ReceiverName
            FROM Packages p
            LEFT JOIN Drivers d ON p.DriverID = d.DriverID
            LEFT JOIN Senders s ON p.SenderID = s.SenderID
            LEFT JOIN Receivers r ON p.ReceiverID = r.ReceiverID
            ORDER BY p.PackageID DESC
        `);
        res.json({ success: true, packages: result.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch packages', details: error.message });
    }
});

//Search function to find specifik package
app.get('/api/packages/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT p.*, 
                       d.FirstName + ' ' + d.LastName AS DriverName,
                       s.FirstName + ' ' + s.LastName AS SenderName,
                       r.FirstName + ' ' + r.LastName AS ReceiverName
                FROM Packages p
                LEFT JOIN Drivers d ON p.DriverID = d.DriverID
                LEFT JOIN Senders s ON p.SenderID = s.SenderID
                LEFT JOIN Receivers r ON p.ReceiverID = r.ReceiverID
                WHERE p.PackageID = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Package not found' });
        }
        res.json({ success: true, package: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch package', details: error.message });
    }
});

app.get('/api/package/me', verifyToken, async (req, res) => {
  try {
    const { UserName, Role } = req.user; // Data from JWT token
    const pool = await getPool();

    //Gets UserID connected to correct table
    const idQuery = `
      SELECT ${TableId} AS UserTableID
      FROM ${TableName}
      WHERE UserName = @UserName
    `;

    const idResult = await pool.request()
      .input('UserName', sql.NVarChar, UserName)
      .query(idQuery);

    if (idResult.recordset.length === 0) {
      return res.status(404).json({ message: 'User not found in ' + TableName });
    }

    const userId = idResult.recordset[0].UserTableID;

    // Gets all packages info connectet to the UserID
    const packageQuery = `
      SELECT 
        p.*, 
        d.FirstName + ' ' + d.LastName AS DriverName,
        s.FirstName + ' ' + s.LastName AS SenderName,
        r.FirstName + ' ' + r.LastName AS ReceiverName,
        a.ArduinoID,
        sd.Temperature,
        sd.Humidity,
        sd.SensorTimeStamp AS LatestSensorReading
      FROM Packages p
      LEFT JOIN Drivers d ON p.DriverID = d.DriverID
      LEFT JOIN Senders s ON p.SenderID = s.SenderID
      LEFT JOIN Receivers r ON p.ReceiverID = r.ReceiverID
      LEFT JOIN Arduinos a ON p.PackageID = a.PackageID
      LEFT JOIN (
          SELECT 
              ArduinoID, 
              Temperature, 
              Humidity, 
              SensorTimeStamp,
              ROW_NUMBER() OVER (PARTITION BY ArduinoID ORDER BY SensorTimeStamp DESC) AS rn
          FROM SensorData
      ) sd ON a.ArduinoID = sd.ArduinoID AND sd.rn = 1
      WHERE p.${TableId} = @UserId
      ORDER BY p.PackageID DESC;
    `;

    const packages = await pool.request()
      .input('UserId', sql.Int, userId)
      .query(packageQuery);

    res.json({ success: true, packages: packages.recordset });

  } catch (error) {
    console.error('GET /api/package/me error:', error);
    res.status(500).json({ error: 'Failed to fetch packages', details: error.message });
  }
});


//Gets driver by driverID
app.get('/api/packages/driver/:driverId', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('driverId', sql.Int, req.params.driverId)
            .query('SELECT * FROM Packages WHERE DriverID = @driverId ORDER BY PackageID DESC');
        res.json({ success: true, packages: result.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch packages', details: error.message });
    }
});

//Create new package
app.post('/api/packages', async (req, res) => {
    try {
        const { DriverID, SenderID, ReceiverID, PackageWidth, PackageHeight, PackageWeight, PackageDepth, Origin, Destination } = req.body;

        if (!DriverID || !SenderID || !ReceiverID || !PackageWidth || !PackageHeight || !PackageWeight || !PackageDepth || !Origin || !Destination) {
            return res.status(400).json({ error: 'DriverID, SenderID, ReceiverID, PackageWidth, PackageHeight, PackageWeight, PackageDepth, Origin, Destination are required' });
        }

        const pool = await getPool();
        const result = await pool.request()
            .input('DriverID', sql.Int, DriverID)
            .input('SenderID', sql.Int, SenderID)
            .input('ReceiverID', sql.Int, ReceiverID)
            .input('Status', sql.NVarChar, 'Registered')
            .input('PackageWidth', sql.Decimal(10, 2), PackageWidth)
            .input('PackageHeight', sql.Decimal(10, 2), PackageHeight)
            .input('PackageWeight', sql.Decimal(10, 2), PackageWeight)
            .input('PackageDepth', sql.Decimal(10, 2), PackageDepth)
            .input('Origin', sql.NVarChar, Origin)
            .input('Destination', sql.NVarChar, Destination)
            .query(`
                INSERT INTO Packages (DriverID, SenderID, ReceiverID, Status, PackageWidth, PackageHeight, PackageWeight, PackageDepth, Origin, Destination)
                OUTPUT INSERTED.*
                VALUES (@DriverID, @SenderID, @ReceiverID, @Status, @PackageWidth, @PackageHeight, @PackageWeight, @PackageDepth, @Origin, @Destination)
            `);

        res.status(201).json({ success: true, package: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create package', details: error.message });
    }
});

//Update package status
app.put('/api/package/status', async (req, res) => {
  try {
    const {PackageID, Status} = req.body
  if(!PackageID || !Status){
    return res.status(401).json({error:"You need to enter PackageID and Status"})
  }
  const pool = await getPool();
  const result = await pool.request()
            .input('PackageID', sql.Int, PackageID)
            .input('Status', sql.VarChar, Status)
            .query(`
                UPDATE Packages
                SET Status=@Status
                WHERE PackageID=@PackageID;
            `);
  res.json({ message:"You change " + PackageID + " to Status: " + Status})
  } catch (error) {
    res.json({error})
  }

});

//Checks and creates a new Arduino ID with a package connected to it
app.post('/api/arduino', async (req, res) => {
  try {
    const { ArduinoID, PackageID } = req.body;

    //Check so mandatory fields
    if (!ArduinoID || !PackageID) {
      return res.status(400).json({success: false, error: 'You need both ArduinoID and PackageID' });
    }

    const pool = await getPool();

    // Check if arduino alredy exist
    const existing = await pool.request()
      .input('ArduinoID', sql.Int, ArduinoID)
      .query('SELECT PackageID FROM Arduinos WHERE ArduinoID = @ArduinoID');

    if (existing.recordset.length > 0) {
      const existingPackage = existing.recordset[0].PackageID;
      return res.status(400).json({
        error: `Arduino already exists and is linked to PackageID: ${existingPackage}`
      });
    }

    //Adds new arduino to database
    const result = await pool.request()
      .input('ArduinoID', sql.Int, ArduinoID)
      .input('PackageID', sql.Int, PackageID)
      .query(`
        INSERT INTO Arduinos (ArduinoID, PackageID)
        OUTPUT INSERTED.*
        VALUES (@ArduinoID, @PackageID);
      `);

    //Return the result
    res.status(201).json({
      success: true,
      message: 'Arduino linked to package successfully',
      arduino: result.recordset[0]
    });

  } catch (error) {
    console.error('Error in /api/arduino:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Gets all available arduinos
app.get('/api/arduino/available', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT a.ArduinoID, a.PackageID, p.Status
                FROM Arduinos a
                INNER JOIN Packages p ON a.PackageID = p.PackageID
                WHERE p.Status = 'Completed';
            `);
        res.json({ success: true, arduinos: result.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch arduinos', details: error.message });
    }
});
// Gets all available arduinos
app.get('/api/arduino', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT * FROM Arduinos
            `);
        res.json({ success: true, arduinos: result.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch arduinos', details: error.message });
    }
});

//Create sensor data from array of data
app.post('/api/sensordata', async (req, res) => {
  try {
    let data = req.body;

    //Change the json body to a array
    if (!Array.isArray(data)) {
      data = [data];
    }

    if (data.length === 0) {
      return res.status(400).json({ error: 'Empty data array or invalid request body' });
    }

    const pool = await getPool();
    const insertedIds = [];

    for (const sensor of data) {
      const { ArduinoID, Temperature, Humidity, SensorTimeStamp } = sensor;

      if (!ArduinoID) {
        console.warn('Skipping invalid sensor entry (missing ArduinoID):', sensor);
        continue;
      }

      //Sends sensordata to database
      const result = await pool.request()
        .input('ArduinoID', sql.Int, ArduinoID)
        .input('Temperature', sql.Int, Temperature ?? null)
        .input('Humidity', sql.Int, Humidity ?? null)
        .input('SensorTimeStamp', sql.DateTime2, SensorTimeStamp ?? null)
        .query(`
          INSERT INTO SensorData (ArduinoID, Temperature, Humidity, SensorTimeStamp)
          OUTPUT INSERTED.ArduinoID
          VALUES (@ArduinoID, @Temperature, @Humidity, @SensorTimeStamp);
        `);

      insertedIds.push(result.recordset[0].SensorDataID);
    }
    //Check if there was no data inserted
    if(!insertedIds.length > 0){
      return res.status(400).json({
      success: false,
      message: `Empty data array or invalid request body`
    });
    }
    res.status(201).json({
      success: true,
      message: `Inserted ${insertedIds.length} sensor entr${insertedIds.length === 1 ? 'y' : 'ies'}.`
    });

  } catch (error) {
    console.error('Error inserting sensor data:', error);
    res.status(500).json({ error: 'Failed to create sensor data', details: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint couldnt be found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({ error: "Something went wrong!", details: err.message });
});

// Start server
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port: ${port}`)
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`)
});

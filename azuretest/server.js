// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Azure SQL Database konfiguration
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        enableArithAbort: true,
        trustServerCertificate: false
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Global connection pool
let poolPromise;

const getPool = async () => {
    if (!poolPromise) {
        poolPromise = sql.connect(dbConfig);
    }
    return poolPromise;
};

// ============= TEST ENDPOINT =============
app.get('/api/test', (req, res) => {
    res.json({
        message: 'Server is running!',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development'
    });
});

// ============= DEBUG ENDPOINT =============
app.get('/api/debug', (req, res) => {
    res.json({
        env_vars: {
            DB_USER: process.env.DB_USER ? 'SET' : 'MISSING',
            DB_PASSWORD: process.env.DB_PASSWORD ? 'SET' : 'MISSING',
            DB_SERVER: process.env.DB_SERVER ? 'SET' : 'MISSING',
            DB_NAME: process.env.DB_NAME ? 'SET' : 'MISSING'
        },
        actual_values: {
            DB_SERVER: process.env.DB_SERVER || 'MISSING',
            DB_NAME: process.env.DB_NAME || 'MISSING',
            DB_USER: process.env.DB_USER || 'MISSING'
            // Password not shown for security
        }
    });
});

// ============= ROOT & HEALTH =============
app.get('/', (req, res) => {
    res.json({
        message: 'Package Tracking API',
        status: 'online',
        endpoints: {
            drivers: {
                create: 'POST /api/drivers',
                getAll: 'GET /api/drivers',
                getById: 'GET /api/drivers/:id',
                update: 'PUT /api/drivers/:id',
                delete: 'DELETE /api/drivers/:id'
            },
            senders: {
                create: 'POST /api/senders',
                getAll: 'GET /api/senders',
                getById: 'GET /api/senders/:id',
                update: 'PUT /api/senders/:id',
                delete: 'DELETE /api/senders/:id'
            },
            receivers: {
                create: 'POST /api/receivers',
                getAll: 'GET /api/receivers',
                getById: 'GET /api/receivers/:id',
                update: 'PUT /api/receivers/:id',
                delete: 'DELETE /api/receivers/:id'
            },
            packages: {
                create: 'POST /api/packages',
                getAll: 'GET /api/packages',
                getById: 'GET /api/packages/:id',
                update: 'PUT /api/packages/:id',
                delete: 'DELETE /api/packages/:id',
                getByDriver: 'GET /api/packages/driver/:driverId'
            },
            logs: {
                create: 'POST /api/logs',
                getAll: 'GET /api/logs',
                getByPackage: 'GET /api/logs/package/:packageId'
            },
            sensorData: {
                create: 'POST /api/sensordata',
                getByPackage: 'GET /api/sensordata/package/:packageId',
                getLatest: 'GET /api/sensordata/package/:packageId/latest'
            }
        }
    });
});

// Debug endpoint to check environment variables
app.get('/api/debug', (req, res) => {
    res.json({
        env_check: {
            DB_USER: process.env.DB_USER ? 'SET' : 'MISSING',
            DB_PASSWORD: process.env.DB_PASSWORD ? 'SET' : 'MISSING',
            DB_SERVER: process.env.DB_SERVER ? 'SET' : 'MISSING',
            DB_NAME: process.env.DB_NAME ? 'SET' : 'MISSING'
        },
        actual_values: {
            DB_SERVER: process.env.DB_SERVER,
            DB_NAME: process.env.DB_NAME,
            DB_USER: process.env.DB_USER
            // Note: Not showing password for security
        }
    });
});

app.get('/api/health', async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request().query('SELECT 1');
        res.json({ status: 'Database connected', database: process.env.DB_NAME });
    } catch (error) {
        res.status(500).json({ error: 'Database connection failed', details: error.message });
    }
});

// ============= DRIVERS =============
app.post('/api/drivers', async (req, res) => {
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
                VALUES (@FirstName, @LastName, @UserName, @Password)
            `);

        res.status(201).json({ success: true, driver: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create driver', details: error.message });
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

app.get('/api/drivers/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT DriverID, FirstName, LastName, UserName FROM Drivers WHERE DriverID = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }
        res.json({ success: true, driver: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch driver', details: error.message });
    }
});

app.put('/api/drivers/:id', async (req, res) => {
    try {
        const { FirstName, LastName, UserName, Password } = req.body;
        const pool = await getPool();

        let updates = [];
        let request = pool.request().input('id', sql.Int, req.params.id);

        if (FirstName) { updates.push('FirstName = @FirstName'); request.input('FirstName', sql.NVarChar, FirstName); }
        if (LastName) { updates.push('LastName = @LastName'); request.input('LastName', sql.NVarChar, LastName); }
        if (UserName) { updates.push('UserName = @UserName'); request.input('UserName', sql.VarChar, UserName); }
        if (Password) { updates.push('Password = @Password'); request.input('Password', sql.VarChar, Password); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const result = await request.query(`
            UPDATE Drivers SET ${updates.join(', ')}
            OUTPUT INSERTED.DriverID, INSERTED.FirstName, INSERTED.LastName, INSERTED.UserName
            WHERE DriverID = @id
        `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }
        res.json({ success: true, driver: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update driver', details: error.message });
    }
});

app.delete('/api/drivers/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM Drivers WHERE DriverID = @id; SELECT @@ROWCOUNT AS affected');

        if (result.recordset[0].affected === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }
        res.json({ success: true, message: 'Driver deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete driver', details: error.message });
    }
});

// ============= SENDERS =============
app.post('/api/senders', async (req, res) => {
    try {
        const { FirstName, LastName, UserName, Password } = req.body;

        if (!FirstName || !LastName || !UserName || !Password) {
            return res.status(400).json({ error: 'All fields required' });
        }

        const pool = await getPool();
        const result = await pool.request()
            .input('FirstName', sql.NVarChar, FirstName)
            .input('LastName', sql.NVarChar, LastName)
            .input('UserName', sql.VarChar, UserName)
            .input('Password', sql.VarChar, Password)
            .query(`
                INSERT INTO Senders (FirstName, LastName, UserName, Password)
                OUTPUT INSERTED.*
                VALUES (@FirstName, @LastName, @UserName, @Password)
            `);

        res.status(201).json({ success: true, sender: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create sender', details: error.message });
    }
});

app.get('/api/senders', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query('SELECT SenderID, FirstName, LastName, UserName FROM Senders');
        res.json({ success: true, senders: result.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch senders', details: error.message });
    }
});

app.get('/api/senders/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT SenderID, FirstName, LastName, UserName FROM Senders WHERE SenderID = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Sender not found' });
        }
        res.json({ success: true, sender: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sender', details: error.message });
    }
});

// ============= RECEIVERS =============
app.post('/api/receivers', async (req, res) => {
    try {
        const { FirstName, LastName, Adress, UserName, Password } = req.body;

        if (!FirstName || !LastName || !UserName || !Password) {
            return res.status(400).json({ error: 'Required fields: FirstName, LastName, UserName, Password' });
        }

        const pool = await getPool();
        const result = await pool.request()
            .input('FirstName', sql.NVarChar, FirstName)
            .input('LastName', sql.NVarChar, LastName)
            .input('Adress', sql.NVarChar, Adress || null)
            .input('UserName', sql.VarChar, UserName)
            .input('Password', sql.VarChar, Password)
            .query(`
                INSERT INTO Receivers (FirstName, LastName, Adress, UserName, Password)
                OUTPUT INSERTED.*
                VALUES (@FirstName, @LastName, @Adress, @UserName, @Password)
            `);

        res.status(201).json({ success: true, receiver: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create receiver', details: error.message });
    }
});

app.get('/api/receivers', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query('SELECT ReceiverID, FirstName, LastName, Adress, UserName FROM Receivers');
        res.json({ success: true, receivers: result.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch receivers', details: error.message });
    }
});

app.get('/api/receivers/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT ReceiverID, FirstName, LastName, Adress, UserName FROM Receivers WHERE ReceiverID = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Receiver not found' });
        }
        res.json({ success: true, receiver: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch receiver', details: error.message });
    }
});

// ============= PACKAGES =============
app.post('/api/packages', async (req, res) => {
    try {
        const { DriverID, SenderID, ReceiverID, PackageWidth, PackageHeight, PackageWeight, PackageDepth } = req.body;

        if (!SenderID || !ReceiverID) {
            return res.status(400).json({ error: 'SenderID and ReceiverID are required' });
        }

        const pool = await getPool();
        const result = await pool.request()
            .input('DriverID', sql.Int, DriverID || null)
            .input('SenderID', sql.Int, SenderID)
            .input('ReceiverID', sql.Int, ReceiverID)
            .input('Registered', sql.DateTime2, new Date())
            .input('PackageWidth', sql.Decimal(10, 2), PackageWidth || null)
            .input('PackageHeight', sql.Decimal(10, 2), PackageHeight || null)
            .input('PackageWeight', sql.Decimal(10, 2), PackageWeight || null)
            .input('PackageDepth', sql.Decimal(10, 2), PackageDepth || null)
            .query(`
                INSERT INTO Packages (DriverID, SenderID, ReceiverID, Registered, PackageWidth, PackageHeight, PackageWeight, PackageDepth)
                OUTPUT INSERTED.*
                VALUES (@DriverID, @SenderID, @ReceiverID, @Registered, @PackageWidth, @PackageHeight, @PackageWeight, @PackageDepth)
            `);

        res.status(201).json({ success: true, package: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create package', details: error.message });
    }
});

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
            ORDER BY p.Registered DESC
        `);
        res.json({ success: true, packages: result.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch packages', details: error.message });
    }
});

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

app.get('/api/packages/driver/:driverId', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('driverId', sql.Int, req.params.driverId)
            .query('SELECT * FROM Packages WHERE DriverID = @driverId ORDER BY Registered DESC');
        res.json({ success: true, packages: result.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch packages', details: error.message });
    }
});

app.put('/api/packages/:id', async (req, res) => {
    try {
        const { DriverID, Delivered, Completed } = req.body;
        const pool = await getPool();

        let updates = [];
        let request = pool.request().input('id', sql.Int, req.params.id);

        if (DriverID !== undefined) { updates.push('DriverID = @DriverID'); request.input('DriverID', sql.Int, DriverID); }
        if (Delivered !== undefined) { updates.push('Delivered = @Delivered'); request.input('Delivered', sql.DateTime2, Delivered); }
        if (Completed !== undefined) { updates.push('Completed = @Completed'); request.input('Completed', sql.DateTime2, Completed); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const result = await request.query(`
            UPDATE Packages SET ${updates.join(', ')}
            OUTPUT INSERTED.*
            WHERE PackageID = @id
        `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Package not found' });
        }
        res.json({ success: true, package: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update package', details: error.message });
    }
});

// ============= LOGS =============
app.post('/api/logs', async (req, res) => {
    try {
        const { PackageID, Level, Message } = req.body;

        if (!PackageID || !Message) {
            return res.status(400).json({ error: 'PackageID and Message are required' });
        }

        const pool = await getPool();
        const result = await pool.request()
            .input('PackageID', sql.Int, PackageID)
            .input('Level', sql.NVarChar, Level || 'INFO')
            .input('Message', sql.NVarChar, Message)
            .input('Timestamp', sql.DateTime, new Date())
            .query(`
                INSERT INTO Logs (PackageID, Level, Message, Timestamp)
                OUTPUT INSERTED.*
                VALUES (@PackageID, @Level, @Message, @Timestamp)
            `);

        res.status(201).json({ success: true, log: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create log', details: error.message });
    }
});

app.get('/api/logs', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query('SELECT * FROM Logs ORDER BY Timestamp DESC');
        res.json({ success: true, logs: result.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch logs', details: error.message });
    }
});

app.get('/api/logs/package/:packageId', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('packageId', sql.Int, req.params.packageId)
            .query('SELECT * FROM Logs WHERE PackageID = @packageId ORDER BY Timestamp DESC');
        res.json({ success: true, logs: result.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch logs', details: error.message });
    }
});

// ============= SENSOR DATA =============
app.post('/api/sensordata', async (req, res) => {
    try {
        const { PackageID, GPSLatitude, GPSLongitude, Temperature, Humidity } = req.body;

        if (!PackageID) {
            return res.status(400).json({ error: 'PackageID is required' });
        }

        const pool = await getPool();
        const result = await pool.request()
            .input('PackageID', sql.Int, PackageID)
            .input('GPSLatitude', sql.Decimal(9, 6), GPSLatitude || null)
            .input('GPSLongitude', sql.Decimal(9, 6), GPSLongitude || null)
            .input('Temperature', sql.Int, Temperature || null)
            .input('Humidity', sql.Int, Humidity || null)
            .input('SensorTimeStamp', sql.DateTime2, new Date())
            .query(`
                INSERT INTO dbo.SensorData (PackageID, GPSLatitude, GPSLongitude, Temperature, Humidity, SensorTimeStamp)
                VALUES (@PackageID, @GPSLatitude, @GPSLongitude, @Temperature, @Humidity, @SensorTimeStamp);
                SELECT SCOPE_IDENTITY() AS Id;
            `);

        res.status(201).json({ success: true, id: result.recordset[0].Id });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create sensor data', details: error.message });
    }
});

app.get('/api/sensordata/package/:packageId', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('packageId', sql.Int, req.params.packageId)
            .query('SELECT * FROM dbo.SensorData WHERE PackageID = @packageId ORDER BY SensorTimeStamp DESC');
        res.json({ success: true, sensorData: result.recordset });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sensor data', details: error.message });
    }
});

app.get('/api/sensordata/package/:packageId/latest', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('packageId', sql.Int, req.params.packageId)
            .query('SELECT TOP 1 * FROM dbo.SensorData WHERE PackageID = @packageId ORDER BY SensorTimeStamp DESC');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'No sensor data found' });
        }
        res.json({ success: true, sensorData: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sensor data', details: error.message });
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    console.log(`API endpoint not found: ${req.originalUrl}`);
    res.status(404).json({ error: 'API endpoint not found', path: req.originalUrl });
});

// Start server
app.listen(port, () => {
    console.log('Package Tracking API running on port ' + port);
    console.log('Environment: ' + (process.env.NODE_ENV || 'development'));
    console.log('Database config check:');
    console.log('- DB_SERVER: ' + (process.env.DB_SERVER ? 'OK' : 'MISSING'));
    console.log('- DB_USER: ' + (process.env.DB_USER ? 'OK' : 'MISSING'));
    console.log('- DB_NAME: ' + (process.env.DB_NAME ? 'OK' : 'MISSING'));
    console.log('- DB_PASSWORD: ' + (process.env.DB_PASSWORD ? 'OK' : 'MISSING'));
}).on('error', (err) => {
    console.error('Server failed to start:', err);
});
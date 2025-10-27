# Backend API - Package Management System

A comprehensive Node.js REST API for managing package deliveries, drivers, senders, receivers, and sensor data. Built with Express.js and Azure SQL Database.

## 🚀 Features

- **User Management** - Register and authenticate drivers, senders, and receivers
- **Package Tracking** - Create, update, and track packages throughout delivery
- **JWT Authentication** - Secure API endpoints with JSON Web Tokens
- **Arduino Integration** - Link IoT devices to packages for real-time monitoring
- **Sensor Data** - Store and retrieve temperature and humidity data from packages
- **Swagger Documentation** - Interactive API documentation at `/api-docs`
- **Azure SQL Database** - Robust cloud database with connection pooling

## 📋 Prerequisites

- Node.js >= 18.0.0
- Azure SQL Database
- npm or yarn package manager

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ChasAcademy-Team-9/Backend.git
   cd Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory with the following variables:
   ```env
   # Database Configuration
   DB_USER=your-database-username
   DB_PASSWORD=your-database-password
   DB_SERVER=your-server.database.windows.net
   DB_NAME=your-database-name

   # JWT Secret
   JWT_SECRET=your-secret-key

   # Server Port (optional, defaults to 8080)
   PORT=8080
   ```

4. **Start the server**
   
   Development mode with auto-reload:
   ```bash
   npm run dev
   ```
   
   Production mode:
   ```bash
   npm start
   ```

## 📚 API Documentation

Interactive API documentation is available at: **`/api-docs`**

When running locally: `http://localhost:8080/api-docs`

Production server: `https://team9-webapp-b9f4e2g8hhfjeras.swedencentral-01.azurewebsites.net/api-docs`

## 🔐 Authentication

Most endpoints require JWT authentication. After logging in, include the token in your requests:

```
Authorization: Bearer <your-jwt-token>
```

### Login Flow

1. Register a user with `POST /api/register`
2. Login with `POST /api/login` to receive a JWT token
3. Include the token in subsequent requests

## 📡 API Endpoints Overview

### User Management
- `POST /api/register` - Register new user (driver, sender, or receiver)
- `POST /api/login` - Login and receive JWT token
- `GET /api/register/drivers` - Get all drivers
- `GET /api/register/senders` - Get all senders
- `GET /api/register/receivers` - Get all receivers
- `PUT /api/register` - Update user information
- `DELETE /api/register` - Delete user account

### Package Management
- `GET /api/packages` - Get all packages with user details
- `GET /api/packages/:id` - Get specific package by ID
- `GET /api/package/me` - Get packages for authenticated receiver (requires JWT)
- `GET /api/packages/driver/:driverId` - Get packages by driver ID
- `POST /api/packages` - Create new package
- `PUT /api/package/status` - Update package status

### Arduino & IoT
- `POST /api/arduino` - Link Arduino device to package
- `GET /api/arduino` - Get all Arduino devices
- `GET /api/arduino/available` - Get available Arduino devices

### Sensor Data
- `POST /api/sensordata` - Store sensor data (temperature, humidity)

## 🗄️ Database Schema

The API uses Azure SQL Database with the following main tables:

### Users Tables
- **Drivers** - Driver information with authentication
- **Senders** - Sender information with authentication
- **Receivers** - Receiver information with authentication

Common fields: `FirstName`, `LastName`, `UserName`, `Password`

### Packages Table
- `PackageID` (Primary Key)
- `DriverID` (Foreign Key)
- `SenderID` (Foreign Key)
- `ReceiverID` (Foreign Key)
- `Status` - Package status (Registered, In Transit, Completed, etc.)
- `PackageWidth`, `PackageHeight`, `PackageWeight`, `PackageDepth`
- `Origin`, `Destination`

### Arduinos Table
- `ArduinoID` (Primary Key)
- `PackageID` (Foreign Key)

### SensorData Table
- `SensorDataID` (Primary Key)
- `ArduinoID` (Foreign Key)
- `Temperature`
- `Humidity`
- `SensorTimeStamp`

## 🌐 Deployment

The API is deployed on Azure App Service with continuous deployment via GitHub Actions.

**Production URL:** `https://team9-webapp-b9f4e2g8hhfjeras.swedencentral-01.azurewebsites.net`

### Azure Configuration

The application uses:
- Azure App Service for hosting
- Azure SQL Database for data storage
- IIS Node configuration via `web.config`

## 📦 Dependencies

### Production Dependencies
- `express` - Web framework
- `mssql` - SQL Server driver
- `jsonwebtoken` - JWT authentication
- `dotenv` - Environment variable management
- `cors` - Cross-origin resource sharing
- `winston` - Logging framework
- `swagger-ui-express` - API documentation

### Development Dependencies
- `nodemon` - Development server with auto-reload

## 🔒 Security Features

- JWT-based authentication with configurable expiration
- Parameterized SQL queries to prevent SQL injection
- Password validation and user verification
- CORS enabled for cross-origin requests
- Encrypted connections to Azure SQL Database

## 📝 Example Usage

### Register a new driver
```bash
curl -X POST http://localhost:8080/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "Role": "driver",
    "FirstName": "John",
    "LastName": "Doe",
    "UserName": "johndoe",
    "Password": "securepassword123"
  }'
```

### Login
```bash
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "Role": "driver",
    "UserName": "johndoe",
    "Password": "securepassword123"
  }'
```

### Create a package
```bash
curl -X POST http://localhost:8080/api/packages \
  -H "Content-Type: application/json" \
  -d '{
    "DriverID": 1,
    "SenderID": 2,
    "ReceiverID": 3,
    "PackageWidth": 10.5,
    "PackageHeight": 20.0,
    "PackageWeight": 5.2,
    "PackageDepth": 15.0,
    "Origin": "Stockholm",
    "Destination": "Gothenburg"
  }'
```

## 🧪 Testing

The API can be tested using:
- Swagger UI at `/api-docs`
- Postman or similar API clients
- curl commands as shown in examples

## 📂 Project Structure

```
Backend/
├── server.js              # Main application file
├── package.json           # Dependencies and scripts
├── swagger.json           # API documentation schema
├── web.config            # IIS configuration for Azure
├── config/
│   └── authentication.js  # JWT verification middleware
├── azure-sql-logging/    # Azure SQL logging module
└── .github/
    └── workflows/        # CI/CD workflows
```

## 🤝 Contributing

This is a team project for Chas Academy Team 9. For contributions:

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

This project is part of Chas Academy Team 9's coursework.

## 👥 Team

Chas Academy - Team 9

## 🆘 Support

For issues or questions:
- Check the Swagger documentation at `/api-docs`
- Review the API endpoint descriptions in this README
- Contact the development team

---

**API Status:** Check `GET /` endpoint for server status and uptime information.

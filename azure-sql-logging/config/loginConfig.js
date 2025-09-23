const loginConfig = {
    server: 'team9-server.database.windows.net',
    port: 1433,
    database: 'team9-database',
    user: 'sqladmin',
    password: 'ch@s@cademy123',
    options: {
        encrypt: true,
        enableArithAbort: true,
        trustServerCertificate: false
    }
}
export default loginConfig;
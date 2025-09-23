const { createLogger, format, transports } = require("winston");
const Transport = require("winston-transport");
const { insertLog } = require("./db");

class AzureSQLTransport extends Transport {
    log(info, callback) {
        setImmediate(() => this.emit("logged", info));
        insertLog(info.level, info.message, info.meta);
        callback();
    }
}

const logger = createLogger({
    level: "info",
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.Console(),
        new AzureSQLTransport()
    ]
});

module.exports = logger;

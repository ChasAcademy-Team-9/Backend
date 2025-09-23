const express = require("express");
const logger = require("./logger");

const app = express();

app.get("/", (req, res) => {
    logger.info("Root endpoint called", { ip: req.ip });
    res.send("Hej från API!");
});

app.get("/error", (req, res) => {
    logger.error("Något gick fel!", { ip: req.ip });
    res.status(500).send("Fel inträffade");
});

app.listen(3000, () => {
    logger.info("Servern körs på port 3000");
});

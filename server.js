// server.js
const express = require("express");
const app = express();

// VIKTIGT: Azure tilldelar porten via miljövariabeln PORT
const port = process.env.PORT || 8080;

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

// Root endpoint - VIKTIGT för Azure
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

// API endpoints
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hej från Azure App Service!" });
});

app.get("/api/items", (req, res) => {
  const items = [
    { id: 1, name: "Item 1" },
    { id: 2, name: "Item 2" },
    { id: 3, name: "Item 3" },
  ];
  res.json(items);
});

app.post("/api/items", (req, res) => {
  const newItem = req.body;
  res.status(201).json({
    message: "Item skapad",
    item: newItem,
  });
});

app.get("/api/items/:id", (req, res) => {
  const id = req.params.id;
  res.json({ id, name: `Item ${id}` });
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

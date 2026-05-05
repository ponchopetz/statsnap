// app.js — entry point

require("dotenv").config();
const express = require("express");

require("./utils/db");

const PORT = process.env.PORT || 3001;
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({ status: "StatSnap API is running" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

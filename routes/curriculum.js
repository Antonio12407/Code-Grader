const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const curriculumPath = path.join(__dirname, "..", "data", "curriculum.json");

// GET full curriculum
router.get("/", (req, res) => {
  try {
    const data = fs.readFileSync(curriculumPath, "utf8");
    const curriculum = JSON.parse(data);
    res.json(curriculum);
  } catch (err) {
    console.error("Failed to read curriculum:", err);
    res.status(500).json({ error: "Failed to load curriculum" });
  }
});

module.exports = router;

const jwt = require("jsonwebtoken");
const SECRET_KEY = "my_secret_key";

const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const usersFile = path.join(__dirname, "../data/users.json");

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFile));

  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    const token = jwt.sign({ username: user.username, role: user.role }, SECRET_KEY, { expiresIn: "2h" });
    res.json({ success: true, token, role: user.role });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

router.post("/users/add", authenticateToken, (req, res) => {
  if (req.user.role !== "teacher") return res.sendStatus(403);

  const { username, password } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFile));

  if (users.find(u => u.username === username)) {
    return res.status(400).json({ success: false, message: "User already exists" });
  }

  users.push({ username, password, role: "student" });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.json({ success: true, message: "Student added" });
});

router.post("/users/delete", authenticateToken, (req, res) => {
  const { username } = req.body;
  let users = JSON.parse(fs.readFileSync(usersFile));
  users = users.filter(u => u.username !== username);
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.json({ success: true, message: "Student deleted" });
});

router.post("/users/deleteAll", authenticateToken, (req, res) => {
  let users = JSON.parse(fs.readFileSync(usersFile));
  users = users.filter(u => u.role !== "student");
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.json({ success: true, message: "All students deleted" });
});

router.get("/users", authenticateToken, (req, res) => {
  const users = JSON.parse(fs.readFileSync(usersFile));
  const students = users
    .filter(u => u.role === "student")
    .map(u => u.username)
    .sort((a, b) => a.localeCompare(b));
  res.json(students);
});

// ✅ NEW: Change password
router.post("/users/changePassword", authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFile));

  const userIndex = users.findIndex(
    (u) => u.username === req.user.username && u.password === currentPassword
  );

  if (userIndex === -1) {
    return res.status(400).json({ success: false, message: "Current password is incorrect." });
  }

  users[userIndex].password = newPassword;
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.json({ success: true, message: "Password changed successfully." });
});

// ✅ Backup users.json
router.get("/users/backup", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.download(usersFile, "users-backup.json");
});


module.exports = router;

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const curriculum = require("./routes/curriculum");
const auth = require("./routes/auth");




const app = express();
app.use(cors());
app.use(express.json());

const submissions = require("./routes/submissions");


app.use("/api/submissions", submissions);
app.use("/api/", auth);
app.use("/api/curriculum", curriculum);


const PORT = 5050;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const submissionRoutes = require("./routes/submissions");
app.use("/api/submissions", submissionRoutes);

const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const { OpenAI } = require("openai");
const ExcelJS = require("exceljs");
const SUBMISSIONS_FILE = path.join(__dirname, "..", "data", "submissions.json");
const MASTER_CSV_PATH = path.join(__dirname, "..", "data", "grades_master.csv");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const dbPath = path.join(__dirname, "../data/submissions.json");

function readData() {
  const data = fs.readFileSync(dbPath);
  return JSON.parse(data);
}

function writeData(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

router.get("/", (req, res) => {
  const submissions = readData();
  res.json(submissions);
});

router.post("/", (req, res) => {
  const submissions = readData();
  const newSubmission = { id: Date.now(), ...req.body };
  submissions.push(newSubmission);
  writeData(submissions);
  res.status(201).json(newSubmission);
});

router.post("/grade/:id", async (req, res) => {
  const submissions = readData();
  const subIndex = submissions.findIndex(s => s.id == req.params.id);
  if (subIndex === -1) return res.status(404).json({ error: "Submission not found" });

  const submission = submissions[subIndex];
  try {
    const prompt = `Grade the following code out of 10. After giving it a score out of 10, show that score with this format: score/10, then give a bullet point list as feedback for how the code is wrong. Limit the feedback to 2 or 3 sentences and 1 bullet point per mark lost\n\n${submission.code}`;
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }]
    });

    const feedback = chatResponse.choices[0].message.content;
    submissions[subIndex].status = "graded";
    submissions[subIndex].feedback = feedback;

    // Extract numeric score from feedback (e.g., "10/10")
    const match = feedback.match(/(\d{1,2})\/10/);
    const numericScore = match ? parseInt(match[1]) : 0;
    submissions[subIndex].score = numericScore;

    writeData(submissions);

    await generateMasterXLSX(submissions);

    

    async function generateMasterXLSX(submissions) {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Grades");
    
      const languages = ["HTML", "Java", "Python", "C++"];
      const units = 36;
      const exercisesPerUnit = 10;
      const maxMark = 10;
    
      const studentMap = {};
    
      for (const s of submissions.filter((s) => s.status === "graded")) {
        const student = s.student;
        const language = s.title.match(/- ([A-Za-z+]+)/)?.[1] || "Unknown";
        const unit = Number(s.title.match(/Unit (\d+)/)?.[1]);
        const exercise = Number(s.title.match(/Exercise (\d+)/)?.[1]);
        const score = s.score ?? 0;
    
        if (!studentMap[student]) studentMap[student] = {};
        studentMap[student][`${language}-U${unit}-E${exercise}`] = score;
      }
    
      let currentRow = 1;
    
      for (const language of languages) {
        // Header row: Language label merged across full width
        const colCount = units * (exercisesPerUnit + 1) + 1;
        sheet.mergeCells(currentRow, 1, currentRow, colCount);
        sheet.getCell(currentRow, 1).value = language;
        sheet.getCell(currentRow, 1).alignment = { horizontal: "center", vertical: "middle" };
        sheet.getCell(currentRow, 1).font = { bold: true, size: 14 };
        currentRow++;
    
        // Sub-header: Student Number + Units & Exercises
        const headerRow = ["Student Number"];
        for (let u = 1; u <= units; u++) {
          for (let e = 1; e <= exercisesPerUnit; e++) {
            headerRow.push(`U${u}-E${e}`);
          }
          headerRow.push(`U${u} Total`);
        }
        headerRow.push("Final Total");
        sheet.addRow(headerRow);
        currentRow++;
    
        // Max marks row
        const maxRow = [""];
        for (let u = 1; u <= units; u++) {
          for (let e = 1; e <= exercisesPerUnit; e++) {
            maxRow.push(maxMark);
          }
          maxRow.push(""); // Unit total
        }
        maxRow.push(""); // Final total
        sheet.addRow(maxRow);
        currentRow++;
    
        // Add student rows
        for (const student of Object.keys(studentMap)) {
          const row = [student];
          let finalTotal = 0;
    
          for (let u = 1; u <= units; u++) {
            let unitTotal = 0;
            for (let e = 1; e <= exercisesPerUnit; e++) {
              const key = `${language}-U${u}-E${e}`;
              const mark = studentMap[student][key] || 0;
              row.push(mark);
              unitTotal += mark;
            }
            row.push(unitTotal);
            finalTotal += unitTotal;
          }
    
          row.push(finalTotal);
          sheet.addRow(row);
          currentRow++;
        }
    
        currentRow += 2; // Add spacing between languages
      }
    
      await workbook.xlsx.writeFile(path.join(__dirname, "..", "data", "grades_master.xlsx"));
    }
    

    res.json({ message: "Graded", feedback });
  } catch (err) {
    console.error("Grading error:", err);
    res.status(500).json({ error: "Failed to grade submission" });
  }

});

router.get("/student/:username", (req, res) => {
  const submissions = readData();
  const studentSubmissions = submissions.filter(s => s.student === req.params.username);
  res.json(studentSubmissions);
});

router.get("/download/master", async (req, res) => {
  const filePath = path.join(__dirname, "..", "data", "grades_master.xlsx");
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send("Grade sheet not found.");
  }
});

router.post("/wipeAll", (req, res) => {
  try {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([], null, 2));
    res.json({ success: true, message: "All submissions wiped successfully." });
  } catch (error) {
    console.error("Failed to wipe all submissions:", error);
    res.status(500).json({ success: false, message: "Failed to wipe submissions." });
  }
});

// ✅ Backup submissions.json
router.get("/backup", (req, res) => {
  res.download(SUBMISSIONS_FILE, "submissions-backup.json");
});



module.exports = router;

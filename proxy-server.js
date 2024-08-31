const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  res.send("Connected.");
});

app.post(
  ("/forward",
  async (req, res) => {
    try {
      const data = req.body;

      const response = await axios.post(
        "http://127.0.0.1:11434/api/chat",
        data
      );
      res.json(response.data);
    } catch (e) {
      console.error("Error forwarding request", e.message);
      res
        .status(500)
        .json({ error: "An error occurred while forwarding the request." });
    }
  })
);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

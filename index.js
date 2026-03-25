const express = require("express");
const puppeteer = require("puppeteer-core");

const app = express();

app.get("/", (req, res) => {
  res.send("Proxy läuft!");
});

app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.send("No URL provided");

  try {
    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium-browser', // <-- Render Free Tier
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });

    const content = await page.content();

    await browser.close();
    res.send(content);

  } catch (e) {
    console.error(e);
    res.status(500).send("Error: " + e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));

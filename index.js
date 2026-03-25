const express = require("express");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const app = express();

app.get("/", (req, res) => {
  res.send("Proxy läuft (Optimized for Render).");
});

app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("Keine URL angegeben.");

  let browser = null;

  try {
    // FIX für ETXTBSY: 
    // 1. Wir holen den Pfad VOR dem Launch.
    const executablePath = await chromium.executablePath();
    
    // 2. Wir nutzen exakt die Args von Sparticuz (wichtig für Sandbox!)
    // Falls chromium.args kein Array ist, nutzen wir Fallback-Args.
    const args = chromium.args || [
        "--no-sandbox", "--disable-setuid-sandbox", 
        "--disable-dev-shm-usage", "--disable-gpu"
    ];

    browser = await puppeteer.launch({
      executablePath: executablePath,
      args: args,
      headless: chromium.headless, // Nutze den headless Modus von Sparticuz
      ignoreHTTPSErrors: true,
      defaultViewport: {
        width: 1280,
        height: 720
      }
    });

    const page = await browser.newPage();
    
    await page.goto(url, { 
      waitUntil: "domcontentloaded", 
      timeout: 60000 
    });

    const content = await page.content();

    await browser.close();
    res.send(content);

  } catch (e) {
    console.error("Fehler:", e.message);
    // Browser sicher schließen
    if (browser) await browser.close().catch(() => {});
    res.status(500).send("Fehler beim Laden: " + e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server auf Port ${PORT}`));

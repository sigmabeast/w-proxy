const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

app.get("/", (req, res) => {
  res.send("Proxy läuft! Nutze /proxy?url=DEINE_URL");
});

app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).send("Fehler: Keine URL angegeben.");
  }

  let browser = null;

  try {
    // Startet den Browser mit speziellen Einstellungen für Server-Umgebungen
    browser = await puppeteer.launch({
      // WICHTIG: Diese Argumente sind notwendig auf Render/Linux
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-zygote",
        "--single-process",
        "--disable-gpu"
      ],
      // Headless Modus ist Pflicht auf Servern
      headless: "new",
      // Ignoriert HTTPS Fehler (optional)
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();
    
    // Setzt einen User-Agent, damit Seiten nicht den Bot blockieren
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    // Seite laden
    await page.goto(url, { 
      waitUntil: "domcontentloaded", // Schneller als networkidle2
      timeout: 60000 
    });

    // Inhalt holen
    const content = await page.content();

    await browser.close();
    res.send(content);

  } catch (e) {
    console.error("Proxy Error:", e);
    if (browser) await browser.close(); // Sicherheitshalber schließen
    res.status(500).send("Fehler beim Laden: " + e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));

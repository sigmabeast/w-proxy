const express = require("express");
// Wir nutzen das volle 'puppeteer' Paket, es bringt Chromium mit.
// Kein puppeteer-core mehr, das erspart uns das Suchen nach dem Pfad.
const puppeteer = require("puppeteer");

const app = express();

app.get("/", (req, res) => {
  res.send("Proxy läuft! Nutze /proxy?url=DEINE_URL");
});

app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).send("Fehler: Keine URL angegeben. Nutze ?url=...");
  }

  let browser = null;

  try {
    // Browser starten
    browser = await puppeteer.launch({
      // Wir brauchen keinen executablePath, Puppeteer nutzt den integrierten Browser
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // Wichtig auf Servern mit wenig RAM
        "--disable-accelerated-2d-canvas",
        "--no-zygote",
        "--single-process" // Hilft oft auf Free Tier Servern
      ],
      headless: "new" // Der neue Headless Modus
    });

    const page = await browser.newPage();
    
    // User Agent setzen (optional, verhindert manchmal Bot-Erkennung)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    // Zur URL navigieren
    await page.goto(url, { 
      waitUntil: "networkidle2", // Wartet bis Netzwerk ruhig ist
      timeout: 60000 // 60 Sekunden Timeout für langsame Seiten
    });

    // Inhalt extrahieren
    const content = await page.content();

    await browser.close();
    res.send(content);

  } catch (e) {
    console.error("Fehler beim Proxy:", e);
    if (browser) await browser.close();
    res.status(500).send("Fehler beim Laden der Seite: " + e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));

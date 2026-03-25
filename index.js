const express = require("express");
// Wir nutzen puppeteer-core (ohne Browser) und laden Chromium separat
const puppeteer = require("puppeteer-core");
// Dieser Import sorgt dafür, dass der Browser auf Render verfügbar ist
const chromium = require("@sparticuz/chromium");

const app = express();

app.get("/", (req, res) => {
  res.send("Proxy läuft! Chromium-Lösung aktiv.");
});

app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).send("Keine URL angegeben.");
  }

  let browser = null;

  try {
    // Hier starten wir den Browser mit der Sparticuz-Konfiguration
    browser = await puppeteer.launch({
      // Der Pfad wird automatisch von der Bibliothek geliefert
      executablePath: await chromium.executablePath(),
      // Diese Argumente sind für Server optimiert
      args: chromium.args,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
      defaultViewport: chromium.defaultViewport
    });

    const page = await browser.newPage();
    
    // Optional: User Agent setzen
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

    await page.goto(url, { 
      waitUntil: "domcontentloaded",
      timeout: 60000 
    });

    const content = await page.content();

    await browser.close();
    res.send(content);

  } catch (e) {
    console.error("Fehler:", e);
    if (browser) await browser.close();
    res.status(500).send("Fehler: " + e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));

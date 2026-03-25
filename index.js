const express = require("express");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const app = express();

app.get("/", (req, res) => {
  res.send("Proxy läuft (Optimierte Version).");
});

app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("Keine URL angegeben.");

  // Blockiere Bilder und Fonts, um Daten zu sparen und schneller zu laden (optional)
  const blockResources = req.query.block !== 'false'; 

  let browser = null;

  try {
    const executablePath = await chromium.executablePath();
    
    browser = await puppeteer.launch({
      executablePath: executablePath,
      args: chromium.args,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // 1. BLOCKIEREN VON RESSOURCEN (Optional, macht es viel schneller)
    // Wenn du Bilder/CSS nicht brauchst, lass das aktiviert.
    if (blockResources) {
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const type = req.resourceType();
        // Blockiere Bilder, Fonts und Stylesheets um Bandbreite zu sparen
        if (['image', 'font', 'stylesheet'].includes(type)) {
          req.abort();
        } else {
          req.continue();
        }
      });
    }

    // 2. SEITE LADEN (Nicht auf "networkidle" warten!)
    // 'domcontentloaded' ist viel schneller. Wir warten nicht auf jedes Werbebild.
    await page.goto(url, { 
      waitUntil: "domcontentloaded", 
      timeout: 30000 // 30 Sekunden Timeout
    });

    // 3. WARTEN AUF INHALT (Das ist der Trick für komplexe Seiten!)
    // Wir warten explizit darauf, dass der Body fertig ist.
    // Bei News-Seiten oder Google könnte man hier auf spezifische Selektoren warten.
    try {
      await page.waitForSelector('body', { timeout: 5000 });
      // Optional: Warte noch mal kurz, damit JavaScript nachladen kann
      await new Promise(r => setTimeout(r, 2000)); 
    } catch (e) {
      // Falls timeout, machen wir trotzdem weiter mit dem was wir haben
      console.log("Timeout beim Warten auf Body, nehme was da ist.");
    }

    // 4. INHALT HOLEN
    // Wir holen das komplette HTML
    const content = await page.content();

    await browser.close();
    res.send(content);

  } catch (e) {
    console.error("Proxy Error:", e.message);
    if (browser) await browser.close().catch(() => {});
    res.status(500).send("Fehler: " + e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server auf Port ${PORT}`));

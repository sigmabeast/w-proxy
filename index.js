const express = require("express");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const { URL } = require("url");

const app = express();

// HIER DEINE RENDER URL EINTRAGEN (Ohne Slash am Ende!)
const PROXY_URL = "https://w-unblocker.onrender.com";

// ---------------------------------------------------------
// GLOBALER BROWSER (SINGLETON)
// Wir starten den Browser EINMAL und lassen ihn offen.
// Das verhindert Timeouts und ETXTBSY Fehler.
// ---------------------------------------------------------
let browserInstance = null;

async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }
  
  console.log("Starte neue Browser-Instanz...");
  const executablePath = await chromium.executablePath();
  
  browserInstance = await puppeteer.launch({
    executablePath: executablePath,
    args: chromium.args,
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
    // Timeout erhöhen für den ersten Start auf 60 Sekunden
    timeout: 60000 
  });
  
  // Falls der Browser irgendwann abstürzt, resettet sich die Variable
  browserInstance.on('disconnected', () => {
    console.log("Browser geschlossen.");
    browserInstance = null;
  });
  
  return browserInstance;
}
// ---------------------------------------------------------

app.get("/", (req, res) => {
  res.send("Proxy läuft (Browser Ready Mode).");
});

app.get("/proxy", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send("Keine URL angegeben.");

  let page = null;

  try {
    // 1. Browser holen (startet nur beim ersten Mal, danach sofort da)
    const browser = await getBrowser();
    
    // 2. Neuen Tab öffnen
    page = await browser.newPage();

    // Optional: Blockiere Bilder/Fonts um Daten zu sparen (Entferne das, wenn du Bilder willst)
    // await page.setRequestInterception(true);
    // page.on('request', (req) => {
    //   if (['image', 'font', 'stylesheet'].includes(req.resourceType())) req.abort();
    //   else req.continue();
    // });

    const targetBase = new URL(targetUrl);

    // 3. Seite laden
    await page.goto(targetUrl, { 
      waitUntil: "domcontentloaded", 
      timeout: 30000 
    });

    // Kurz warten für JS
    try {
      await page.waitForSelector('body', { timeout: 2000 });
    } catch (e) {}

    // Inhalt holen
    let content = await page.content();

    // TAB SCHLIESSEN (WICHTIG: Speicher freigeben!)
    await page.close();

    // --- URL REWRITING ---
    content = content.replace(/(href|src|action)=["'](https?:\/\/[^"']+)["']/gi, (match, attr, url) => {
      return `${attr}="${PROXY_URL}/proxy?url=${encodeURIComponent(url)}"`;
    });
    content = content.replace(/(href|src|action)=["'](\/[^"']*)["']/gi, (match, attr, path) => {
      const fullUrl = new URL(path, targetBase.origin).href;
      return `${attr}="${PROXY_URL}/proxy?url=${encodeURIComponent(fullUrl)}"`;
    });
    content = content.replace(/url\(["']?(\/[^"')]+)["']?\)/gi, (match, path) => {
        const fullUrl = new URL(path, targetBase.origin).href;
        return `url("${PROXY_URL}/proxy?url=${encodeURIComponent(fullUrl)}")`;
    });

    res.send(content);

  } catch (e) {
    console.error("Proxy Error:", e.message);
    // Falls ein Fehler auftritt, Tab schließen
    if (page) await page.close().catch(() => {});
    // Bei schweren Fehlern Browser neu starten
    browserInstance = null; 
    res.status(500).send("Fehler: " + e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server auf Port ${PORT}`));

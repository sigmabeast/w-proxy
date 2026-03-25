const express = require("express");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const { URL } = require("url");

const app = express();

// HIER DEINE RENDER URL EINTRAGEN (Ohne Slash am Ende!)
const PROXY_URL = "https://w-unblocker.onrender.com";

// ---------------------------------------------------------
// FIX für ETXTBSY: Browser beim Server-Start VORBREITEN
// Das zwingt Render, Chromium zu entpacken, bevor die erste Anfrage kommt.
// Das dauert beim Start kurz, verhindert aber den Absturz.
// ---------------------------------------------------------
let isChromiumReady = false;
(async () => {
  try {
    console.log("Bereite Chromium vor (Entpacken)...");
    const execPath = await chromium.executablePath();
    // Wir starten einen Browser und schließen ihn sofort wieder.
    // Das stellt sicher, dass die Binary entpackt und bereit ist.
    const tempBrowser = await puppeteer.launch({
      executablePath: execPath,
      args: chromium.args,
      headless: chromium.headless,
    });
    await tempBrowser.close();
    isChromiumReady = true;
    console.log("Chromium ist bereit!");
  } catch (e) {
    console.error("Fehler beim Vorbereiten von Chromium:", e);
  }
})();
// ---------------------------------------------------------

app.get("/", (req, res) => {
  if (!isChromiumReady) return res.send("Proxy startet gerade... bitte 10 Sekunden warten und neu laden.");
  res.send("Proxy bereit. Nutze /proxy?url=...");
});

app.get("/proxy", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send("Keine URL angegeben.");
  
  if (!isChromiumReady) return res.status(503).send("Proxy initialisiert noch. Bitte warten...");

  let browser = null;

  try {
    const targetBase = new URL(targetUrl);
    const executablePath = await chromium.executablePath();

    browser = await puppeteer.launch({
      executablePath: executablePath,
      args: chromium.args,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // Seite laden
    await page.goto(targetUrl, { 
      waitUntil: "domcontentloaded", 
      timeout: 30000 
    });

    // Kurze Pause für JS
    try {
      await page.waitForSelector('body', { timeout: 2000 });
    } catch (e) {}

    let content = await page.content();
    await browser.close();

    // --- URL REWRITING (Damit Bilder/CSS gehen) ---
    
    // 1. Absolute Links (http...)
    content = content.replace(/(href|src|action)=["'](https?:\/\/[^"']+)["']/gi, (match, attr, url) => {
      return `${attr}="${PROXY_URL}/proxy?url=${encodeURIComponent(url)}"`;
    });

    // 2. Relative Links (/...)
    content = content.replace(/(href|src|action)=["'](\/[^"']*)["']/gi, (match, attr, path) => {
      const fullUrl = new URL(path, targetBase.origin).href;
      return `${attr}="${PROXY_URL}/proxy?url=${encodeURIComponent(fullUrl)}"`;
    });
    
    // 3. CSS URLs
    content = content.replace(/url\(["']?(\/[^"')]+)["']?\)/gi, (match, path) => {
        const fullUrl = new URL(path, targetBase.origin).href;
        return `url("${PROXY_URL}/proxy?url=${encodeURIComponent(fullUrl)}")`;
    });

    res.send(content);

  } catch (e) {
    console.error("Proxy Error:", e.message);
    if (browser) await browser.close().catch(() => {});
    res.status(500).send("Fehler: " + e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server auf Port ${PORT}`));

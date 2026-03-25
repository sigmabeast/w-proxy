const express = require("express");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const { URL } = require("url"); // Hilfsmodul für URLs

const app = express();

// HIER DEINE RENDER URL EINTRAGEN (Ohne Slash am Ende!)
const PROXY_URL = "https://w-unblocker.onrender.com";

app.get("/", (req, res) => {
  res.send("Proxy läuft. Nutze /proxy?url=...");
});

app.get("/proxy", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send("Keine URL angegeben.");

  let browser = null;

  try {
    // Ziel-URL parsen, um den Basis-Pfad zu kennen
    const targetBase = new URL(targetUrl);

    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      executablePath: executablePath,
      args: chromium.args,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // Wir blockieren NICHTS mehr, damit Styles und Bilder geladen werden
    // Wir laden die Seite
    await page.goto(targetUrl, { 
      waitUntil: "domcontentloaded", 
      timeout: 30000 
    });

    // Warten, damit JS Inhalte nachladen kann
    try {
      await page.waitForSelector('body', { timeout: 3000 });
      await new Promise(r => setTimeout(r, 1000)); 
    } catch (e) {}

    // HTML holen
    let content = await page.content();

    await browser.close();

    // --- DIE MAGIE: URL REWRITING ---
    // Wir ersetzen alle Links, damit sie durch den Proxy laufen
    
    // 1. Absolute Links (http://seite.com/css...) umschreiben
    // Sucht nach href="http..." und src="http..."
    content = content.replace(/(href|src|action)=["'](https?:\/\/[^"']+)["']/gi, (match, attr, url) => {
      // Die URL durch unseren Proxy leiten
      return `${attr}="${PROXY_URL}/proxy?url=${encodeURIComponent(url)}"`;
    });

    // 2. Relative Links (/css/style.css) umschreiben
    // Sucht nach href="/css..." und src="/images..."
    content = content.replace(/(href|src|action)=["'](\/[^"']*)["']/gi, (match, attr, path) => {
      // Basis-URL der Zielseite + Pfad bauen
      const fullUrl = new URL(path, targetBase.origin).href;
      return `${attr}="${PROXY_URL}/proxy?url=${encodeURIComponent(fullUrl)}"`;
    });
    
    // 3. CSS-Links in <head> reparieren (manchmal spezielle Syntax)
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

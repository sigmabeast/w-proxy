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
    // HIER IST DIE LÖSUNG:
    // Wir starten Puppeteer OHNE spezifischen executablePath.
    // Wenn eine Env-Variable 'PUPPETEER_EXECUTABLE_PATH' existiert (von Render),
    // wird sie von puppeteer.executablePath() automatisch korrekt aufgelöst.
    browser = await puppeteer.launch({
      executablePath: puppeteer.executablePath(), // Zwingt die Nutzung der mitgelieferten Chromium-Version
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-zygote",
        "--single-process",
        "--disable-gpu"
      ],
      headless: "new",
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    await page.goto(url, { 
      waitUntil: "domcontentloaded",
      timeout: 60000 
    });

    const content = await page.content();

    await browser.close();
    res.send(content);

  } catch (e) {
    console.error("Proxy Error:", e);
    if (browser) await browser.close();
    res.status(500).send("Fehler beim Laden: " + e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));

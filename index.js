const express = require("express");
const puppeteer = require("puppeteer-core");

const app = express();

app.get("/", (req, res) => {
  res.send("Proxy läuft!");
});

app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.send("No URL");

  try {
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });

    const content = await page.content();

    await browser.close();
    res.send(content);

  } catch (e) {
    res.send("Error: " + e.message);
  }
});

app.listen(3000, () => console.log("Server läuft"));

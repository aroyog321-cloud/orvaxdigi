const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

const MAX_HTML_BYTES = 2 * 1024 * 1024;

function reply(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return reply(res, 405, { error: "Method not allowed" });
  }

  const html = typeof req.body?.html === "string" ? req.body.html : "";
  const filename = typeof req.body?.filename === "string"
    ? req.body.filename.replace(/[^a-zA-Z0-9._-]/g, "-")
    : "product.pdf";

  if (!html.trim()) return reply(res, 400, { error: "html is required" });
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    return reply(res, 413, { error: "html exceeds 2 MB limit" });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: ["domcontentloaded", "networkidle0"],
      timeout: 30000
    });
    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" }
    });

    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="' +
      (filename.endsWith(".pdf") ? filename : filename + ".pdf") + '"');
    res.setHeader("Cache-Control", "no-store");
    return res.end(pdf);
  } catch (error) {
    console.error("PDF_RENDER_ERROR", error);
    return reply(res, 500, {
      error: "PDF rendering failed",
      message: error?.message || "Unknown renderer error"
    });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};

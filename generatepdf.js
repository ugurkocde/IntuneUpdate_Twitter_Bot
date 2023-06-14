const puppeteer = require("puppeteer");

async function run() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // navigate to the URL
  await page.goto("https://www.ugurkoc.de", {
    waitUntil: "networkidle2", // wait until the network is idle
  });

  await page.addStyleTag({
    content: `
    header, footer, .some-css-class { 
        display: none !important; 
    }
`,
  });

  // create a PDF from the loaded page
  await page.pdf({
    path: "page.pdf", // specify the path in pdf function
    format: "A4",
    printBackground: true,
  });

  await browser.close();
  console.log("PDF generated!");
}

run();

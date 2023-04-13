const puppeteer = require("puppeteer");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function fetchWhatsNew() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(
    "https://github.com/MicrosoftDocs/memdocs/commits/main/memdocs/intune/fundamentals/whats-new.md"
  );

  // Wait for the list of commits to be loaded
  await page.waitForSelector(
    ".flex-auto.min-width-0.js-details-container.Details"
  );

  // Get the list of commits
  const commitList = await page.$$eval(".commit-group-title", (titles) =>
    titles.map((title) => ({
      url: title.querySelector("a").href,
      author: title.querySelector(".user-mention").innerText,
      title: title.querySelector(".message").innerText,
      content: title.nextElementSibling.innerText.trim(),
    }))
  );

  // Filter out duplicates
  const existingUrls = await prisma.whatsNew.findMany({
    select: { url: true },
  });
  const newCommits = commitList.filter(
    (commit) => !existingUrls.some((url) => url.url === commit.url)
  );

  // Save new commits to the database
  newCommits.forEach(async (commit) => {
    try {
      await prisma.whatsNew.create({
        data: {
          url: commit.url,
          author: commit.author,
          title: commit.title,
          content: commit.content,
        },
      });
      console.log(`Added new commit to database: ${commit.title}`);
    } catch (error) {
      console.error(`Error adding commit to database: ${error.message}`);
    }
  });

  await browser.close();
}

module.exports = { fetchWhatsNew };

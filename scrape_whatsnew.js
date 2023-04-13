const puppeteer = require("puppeteer");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function fetchWhatsNew() {
  console.log("Starting fetchWhatsNew function");
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  // console.log("Browser opened and new page created");

  await page.goto(
    "https://github.com/MicrosoftDocs/memdocs/commits/main/memdocs/intune/fundamentals/whats-new.md"
  );
  // console.log("Navigated to the GitHub page");

  // Get the list of commits
  const commitList = await page.$$eval(
    ".flex-auto.min-width-0.js-details-container.Details",
    (commits) =>
      commits.map((commit) => ({
        url: commit.querySelector(
          ".Link--primary.text-bold.js-navigation-open.markdown-title"
        ).href,
        author: commit
          .querySelector(".commit-author.user-mention")
          .textContent.trim(),
        title: commit
          .querySelector(
            ".Link--primary.text-bold.js-navigation-open.markdown-title"
          )
          .textContent.trim(),
      }))
  );
  console.log(`Found ${commitList.length} commits`);

  // Filter out duplicates
  const existingUrls = await prisma.WhatsNew.findMany({
    select: { url: true },
  });
  const newCommits = commitList.filter(
    (commit) => !existingUrls.some((url) => url.url === commit.url)
  );
  console.log(`Found ${newCommits.length} new commits`);

  // Save new commits to the database
  newCommits.forEach(async (commit) => {
    try {
      await prisma.WhatsNew.create({
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
  // console.log("Browser closed");
}

// fetchWhatsNew().catch((err) => console.error(err));

module.exports = { fetchWhatsNew };

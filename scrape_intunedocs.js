const puppeteer = require("puppeteer");
const { PrismaClient } = require("@prisma/client");
const { Configuration, OpenAIApi } = require("openai");

const prisma = new PrismaClient();
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function fetchIntuneDocs() {
  console.log("Starting fetchIntuneDocs function");
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();

  await page.goto(
    "https://github.com/MicrosoftDocs/memdocs/commits/main/memdocs/intune"
  );

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

  const existingUrls = await prisma.IntuneDocs.findMany({
    select: { url: true },
  });
  const newCommits = commitList.filter((commit) => {
    const isDuplicate = existingUrls.some((url) => url.url === commit.url);
    const isBot = commit.author.toLowerCase().includes("bot");
    return !isDuplicate && !isBot;
  });

  console.log(`Found ${newCommits.length} new commits`);

  for (const commit of newCommits) {
    try {
      // Navigate to the commit page to get the content
      //console.log(commit.url);

      // Navigate to the commit page to get the content
      await page.goto(commit.url, { waitUntil: "networkidle2" });

      // Scrape the content of the commit
      let commitContent;
      try {
        commitContent = await page.$eval(
          '[data-tagsearch-lang="Markdown"]',
          (el) => el.innerText
        );
      } catch (error) {
        if (
          error.message.includes("failed to find element matching selector")
        ) {
          //console.warn(`Skipping commit ${commit.url}: no markdown file found`);
          continue;
        } else {
          throw error;
        }
      }

      // Use OpenAI to summarize the content of the commit
      const prompt = `What's a fact or interesting tidbit related to this commit, in particular to the new added content and not the deleted ones, for someone that has not seen the content ever before? Limit your response to a maximum of 25 words. \n\n${commitContent}`;
      const aiResponse = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `${prompt}` }],
        temperature: 0.2,
      });
      const summary = aiResponse.data.choices[0].message.content;

      // Save the new commit to the database
      await prisma.IntuneDocs.create({
        data: {
          url: commit.url,
          author: commit.author,
          title: commit.title,
          summary: summary,
        },
      });
      console.log(`Added new commit to database: ${commit.title}`);
    } catch (error) {
      console.error(`Error adding commit to database: ${error.message}`);
    }
  }

  await browser.close();
}

fetchIntuneDocs().catch((err) => console.error(err));

module.exports = { fetchIntuneDocs };

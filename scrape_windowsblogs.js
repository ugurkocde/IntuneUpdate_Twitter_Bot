const puppeteer = require("puppeteer");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function fetchWindowsBlogPosts() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  console.log("Checking Windows IT Pro Blog...");

  await page.goto(
    "https://techcommunity.microsoft.com/t5/windows-it-pro-blog/bg-p/Windows10Blog",
    { waitUntil: "networkidle2" }
  );

  const data = await page.evaluate(() => {
    const posts = Array.from(
      document.querySelectorAll(
        ".lia-quilt-row.lia-quilt-row-main .lia-quilt-column-single"
      )
    );
    const uniquePosts = [];

    for (const post of posts) {
      const titleElement = post.querySelector(".MessageSubject h1 a");
      const title = titleElement ? titleElement.textContent.trim() : null;
      const urlElement = post.querySelector(".blog-article-image-wrapper a");
      const url = urlElement ? urlElement.href : null;
      const dateElement = post.querySelector(
        ".author-details .post-time-text:last-child"
      );
      const date = dateElement ? dateElement.textContent.trim() : null;
      const pictureElement = post.querySelector(
        ".blog-article-image-wrapper img"
      );
      const pictureUrl = pictureElement ? pictureElement.src : null;

      if (url) {
        uniquePosts.push({ title, url, date, pictureUrl });
      }
    }

    return uniquePosts;
  });

  // Now that we have the data, let's save it to the database.
  for (const post of data) {
    try {
      const existingPost = await prisma.WindowsBlogPost.findUnique({
        where: { url: post.url },
      });

      if (!existingPost) {
        await prisma.WindowsBlogPost.create({
          data: {
            title: post.title,
            url: post.url,
            date: post.date, // You may need to convert this to a Date object
            author: "Microsoft",
            pictureUrl: post.pictureUrl,
          },
        });
      }
    } catch (error) {
      console.error(`Error saving to database: ${error.message}`);
    }
  }

  await browser.close();
}

// fetchWindowsBlogPosts().catch(console.error);

module.exports = { fetchWindowsBlogPosts };

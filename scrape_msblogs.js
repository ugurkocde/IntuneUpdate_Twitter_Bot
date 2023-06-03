const puppeteer = require("puppeteer");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function fetchMSBlogPosts() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  console.log("Checking MS Blogs...");

  await page.goto(
    "https://techcommunity.microsoft.com/t5/microsoft-intune-blog/bg-p/MicrosoftEndpointManagerBlog",
    { waitUntil: "networkidle2" }
  );

  const data = await page.evaluate(() => {
    const posts = Array.from(
      document.querySelectorAll(
        ".lia-quilt-row.lia-quilt-row-main .lia-quilt-column-single"
      )
    );
    const uniquePosts = [];
    const urls = new Set();

    for (const post of posts) {
      const titleElement = post.querySelector(".MessageSubject h1 a");
      const title = titleElement ? titleElement.textContent.trim() : null;
      const url = titleElement ? titleElement.href : null;
      const dateElement = post.querySelector(
        ".author-details .post-time-text:last-child"
      );
      const date = dateElement ? dateElement.textContent.trim() : null;

      const pictureElement = post.querySelector(
        ".blog-article-image-wrapper img"
      );
      const pictureUrl = pictureElement ? pictureElement.src : null;

      if (url && !urls.has(url)) {
        urls.add(url);
        uniquePosts.push({ title, url, date, pictureUrl });
      }
    }

    return uniquePosts;
  });

  // console.log(data);

  // Now that we have the data, let's save it to the database.
  for (const post of data) {
    try {
      await prisma.MSBlogPost.create({
        data: {
          title: post.title,
          url: post.url,
          date: post.date, // You may need to convert this to a Date object
          author: "Microsoft",
          pictureUrl: post.pictureUrl,
        },
      });
      // console.log(`Saved to Supabase: ${post.title}`);
    } catch (error) {
      console.error(`Error saving to Supabase: ${error.message}`);
    }
  }

  await browser.close();
}

// fetchMSBlogPosts().catch(console.error);

module.exports = { fetchMSBlogPosts };

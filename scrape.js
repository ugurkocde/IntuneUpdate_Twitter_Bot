const axios = require("axios");
const cheerio = require("cheerio");
const Parser = require("rss-parser");
const puppeteer = require("puppeteer");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function fetchBlogPosts() {
  // Read the feed URLs and author names from feeds.json
  const feeds = require("./feeds.json");
  console.log(`Found ${feeds.length} feeds.`);

  let addedCount = 0; // Counter for the number of blog posts added to the database

  // Loop through each feed and fetch its blog posts
  for (const feed of feeds) {
    console.log(`Fetching RSS feed at ${feed.url}...`);

    let parsedFeed;
    try {
      const parser = new Parser();
      parsedFeed = await parser.parseURL(feed.url);
      console.log(
        `Fetched ${parsedFeed.items.length} blog posts from RSS feed.`
      );
    } catch (err) {
      console.error(`Error fetching RSS feed at ${feed.url}: ${err}`);
      continue; // Skip this feed and move on to the next one
    }

    // Loop through each blog post and save it to the database
    for (const item of parsedFeed.items) {
      // Check if the blog post URL is already in the database
      const existingPost = await prisma.blogPost.findUnique({
        where: { url: item.link },
      });
      if (existingPost) {
        continue;
      }

      let title, content, author;
      const response = await axios.get(item.link);
      const $ = cheerio.load(response.data);

      title = $("h1").text().trim();
      content = $("content").text().trim();

      // If the content is empty, use Puppeteer to load the URL and extract the content
      if (!content) {
        console.log(
          `Content not found. Using Puppeteer to extract content for ${item.link}...`
        );

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(item.link, { waitUntil: "networkidle2" });
        content = await page.$eval("*", (el) => el.innerText);
        await browser.close();
      }

      console.log(`Extracted title: ${title}`);

      // Set the author to the value in the feeds.json file, or to an empty string if not specified
      author = feed.author || "";

      await prisma.blogPost.create({
        data: { title, content, url: item.link, author },
      });

      addedCount++; // Increment the counter
    }
  }

  console.log(`Added ${addedCount} new blog posts to the database.`);

  await prisma.$disconnect();
}

module.exports = { fetchBlogPosts };

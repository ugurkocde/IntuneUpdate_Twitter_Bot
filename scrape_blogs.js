const axios = require("axios");
const cheerio = require("cheerio");
const Parser = require("rss-parser");
const puppeteer = require("puppeteer");
const { PrismaClient } = require("@prisma/client");
const { Configuration, OpenAIApi } = require("openai");

const prisma = new PrismaClient();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

async function fetchBlogPosts() {
  // Read the feed URLs and author names from feeds.json
  const feeds = require("./feeds.json");
  console.log(
    `[${new Date().toLocaleString("en-US", { timeZone: "CET" })}] Found ${
      feeds.length
    } feeds.`
  );

  let addedCount = 0; // Counter for the number of blog posts added to the database

  // Loop through each feed and fetch its blog posts
  for (const feed of feeds) {
    console.log(`Fetching RSS feed at ${feed.url}...`);

    let parsedFeed;
    try {
      const parser = new Parser();
      parsedFeed = await parser.parseURL(feed.url);
      // console.log(`Fetched ${parsedFeed.items.length} blog posts from RSS feed.`);
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

      let title, content, twitterauthor;
      const response = await axios.get(item.link);
      const $ = cheerio.load(response.data);

      title = $("title").text().trim();

      // Attempt to extract content from both "content" and "content:encoded" tags
      content =
        $("content").text().trim() || $("content\\:encoded").text().trim();

      if (content.length > 7000) {
        content = content.slice(0, 7000);
      }

      // If the content is still empty, use Puppeteer to load the URL and extract the content
      if (!content) {
        const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
        const page = await browser.newPage();
        await page.goto(item.link, { waitUntil: "networkidle2" });
        content = await page.$eval("*", (el) => el.innerText);
        if (content.length > 7000) {
          content = content.slice(0, 7000);
        }
        await browser.close();
      }

      // Summarize the content only for newly added blog posts
      const prompt = `Summarize the following text. Don´t use the title to summarize the article. Focus on the content. Your summary should be different from the Title. Dont add any tags or hashwords with # and dont tell people were to download or get a script. Dont use the title and header of the text in your response. Be precise as possible without exceeding 18 words in your response. \n\n${content}.`;
      const aiResponse = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `${prompt}` }],
        temperature: 0.2,
      });
      const summary = aiResponse.data.choices[0].message.content;

      console.log(`New Blog! -> ${title}`);

      // Set the author to the value in the feeds.json file, or to an empty string if not specified
      twitterauthor = feed.twitterauthor || "";
      author = feed.author || "";

      await prisma.blogPost.create({
        data: {
          title,
          content,
          url: item.link,
          author,
          summary: summary,
          twitterauthor,
          createdAt: new Date(item.pubDate),
        },
      });

      addedCount++; // Increment the counter
    }
  }

  console.log(`Added ${addedCount} new blog posts to the database.`);

  await prisma.$disconnect();
}

// fetchBlogPosts().catch((err) => console.error(err));

module.exports = { fetchBlogPosts };
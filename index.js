require("dotenv").config({ path: __dirname + "/.env" });
const express = require("express");
const app = express();
const port = process.env.PORT || 8080;
const { Configuration, OpenAIApi } = require("openai");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
const puppeteer = require("puppeteer");

const { fetchWhatsNew } = require("./scrape_whatsnew.js"); // import the function
const { google } = require("googleapis");

const youtubeApiKey = process.env.YouTube_API_KEY;

// YouTube Data API client
const youtube = google.youtube({
  version: "v3",
  auth: youtubeApiKey,
});

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const { twitterClient } = require("./twitterClient.js");

const youtubefeeds = require("./youtubefeeds.json");

const { fetchBlogPosts } = require("./scrape_blogs.js"); // import the function

const tweetNewRows = async () => {
  try {
    const data = await prisma.BlogPost.findMany({
      where: {
        tweeted: false,
      },
    });
    data.forEach(async (row) => {
      const { title, content, author } = row;
      try {
        const prompt = `Your answer can only be 20 words long. Summarize the following text. Dont use the title to summarize the article. Focus on the content. Your summary should be different from the Title. Dont add any tags or hashwords with # and dont tell people were to download or get a script. Dont use the title and header of the text in your response. Be precise as possible without exceeding 20 words in your response. \n\n${content}.`;
        const aiResponse = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: `${prompt}` }],
          temperature: 0.2,
        });
        let truncatedTitle = title;
        if (title.length > 40) {
          truncatedTitle = title.slice(0, 40) + "...";
        }
        const summary = aiResponse.data.choices[0].message.content;
        const tweetText = `${truncatedTitle}:\n\n${summary}\n\n${author}`;
        await twitterClient.v2.tweet(tweetText);
        console.log(`Tweeted: ${tweetText}`);
        await prisma.BlogPost.update({
          where: {
            id: row.id,
          },
          data: {
            tweeted: true,
          },
        });
      } catch (e) {
        console.log(e);
      }
    });
  } catch (e) {
    console.log(e);
  }
};

const tweetNewCommits = async () => {
  try {
    const data = await prisma.WhatsNew.findMany({
      where: {
        tweeted: false,
      },
    });
    data.forEach(async (row) => {
      const { title, content, author, url } = row;
      try {
        const tweetText = `${title} by ${author}\n\n${url}`;
        await twitterClient.v2.tweet(tweetText);
        console.log(`Tweeted: ${tweetText}`);
        await prisma.WhatsNew.update({
          where: {
            id: row.id,
          },
          data: {
            tweeted: true,
          },
        });
      } catch (e) {
        console.log(e);
      }
    });
  } catch (e) {
    console.log(e);
  }
};

let lastCheckedDate = null;

const getNewVideos = async (channelId, channelName) => {
  try {
    const response = await youtube.search.list({
      part: "snippet",
      channelId: channelId,
      order: "date",
      type: "video",
      maxResults: 5,
    });
    const latestVideoDate = new Date(
      response.data.items[0].snippet.publishedAt
    );
    if (latestVideoDate > lastCheckedDate) {
      const latestVideoTitle = response.data.items[0].snippet.title;
      const latestVideoLink = `https://www.youtube.com/watch?v=${response.data.items[0].id.videoId}`;
      const tweetText = `New video on the ${channelName} YouTube channel: ${latestVideoTitle}\n\n${latestVideoLink}\n\n#Intune #Microsoft #YouTube`;
      await twitterClient.v2.tweet(tweetText);
      lastCheckedDate = latestVideoDate;
      console.log(`Checked ${channelName} successfully`);
    }
  } catch (error) {
    console.error(
      `Error while getting new videos for ${channelName}: ${error.message}`
    );
  }
};

// Get new posts from the Tech Community page
const getNewTechCommunityPosts = async () => {
  try {
    const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.goto(
      "https://techcommunity.microsoft.com/t5/intune-customer-success/bg-p/IntuneCustomerSuccess"
    );
    const latestPostLink = await page.$eval(
      "div.blog-article-image-wrapper a",
      (a) => a.href
    );
    const latestPostDate = await page.$eval(
      "time.published",
      (time) => new Date(time.dateTime)
    );
    if (latestPostDate > lastCheckedDate) {
      const tweetText = `New blog post on Intune Customer Success: ${latestPostLink}\n\n#Intune #Microsoft`;
      await twitterClient.v2.tweet(tweetText);
      lastCheckedDate = latestPostDate;
      console.log(`Checked the Tech Community page successfully`);
    }
    await browser.close();
  } catch (error) {
    console.error(
      `Error while parsing the Tech Community page: ${error.message}`
    );
  }
};

// Poll the database every 10 minutes
const interval = setInterval(async () => {
  await tweetNewRows();
  await tweetNewCommits();
}, 60 * 60 * 1000);

// call the fetchBlogPosts function every 5 minutes
setInterval(async () => {
  //await fetchBlogPosts();
  await fetchWhatsNew();

  for (const channel of youtubefeeds) {
    await getNewVideos(channel.channelId, channel.channelName);
  }
  await tweetNewCommits();
  await getNewTechCommunityPosts();
}, 1 * 60 * 1000);

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

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

const { fetchYouTubeVideos } = require("./scrape_youtube.js");
const { fetchIntuneDocs } = require("./scrape_intunedocs.js");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const { twitterClient } = require("./twitterClient.js");
const { fetchBlogPosts } = require("./scrape_blogs.js"); // import the function

const tweetNewRows = async () => {
  try {
    const data = await prisma.BlogPost.findMany({
      where: {
        tweeted: false,
      },
    });
    data.forEach(async (row) => {
      const { title, content, author, url } = row;
      try {
        const prompt = `Your answer can only be 18 words long. Summarize the following text. Dont use the title to summarize the article. Focus on the content. Your summary should be different from the Title. Dont add any tags or hashwords with # and dont tell people were to download or get a script. Dont use the title and header of the text in your response. Be precise as possible without exceeding 18 words in your response. \n\n${content}.`;
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
        const tweetText = `[New Blog Post] ${truncatedTitle}\n\n${summary}\n\n${url} ${author}\n\n#Intune #Microsoft`;
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
    const data = await prisma.IntuneDocs.findMany({
      where: {
        tweeted: false,
      },
    });
    data.forEach(async (row) => {
      const { summary, url } = row;
      try {
        const tweetText = `Detected changes in the Intune Documentation: \n\n${summary}\n\n#Intune #Microsoft\n\n${url}`;
        await twitterClient.v2.tweet(tweetText);
        console.log(`Tweeted: ${tweetText}`);
        await prisma.IntuneDocs.update({
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

const tweetYoutubeVideo = async () => {
  try {
    const data = await prisma.YoutubeVideos.findMany({
      where: {
        tweeted: false,
      },
    });
    data.forEach(async (row) => {
      const { title, url, author } = row;
      try {
        const tweetText = `[New Video] ${title}\n\n${url} ${author}\n\n#Intune #Microsoft`;
        await twitterClient.v2.tweet(tweetText);
        console.log(`Tweeted: ${tweetText}`);
        await prisma.YoutubeVideos.update({
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

// GET YOUTUBE DATA EVERY 5 HOURS
setInterval(async () => {
  await fetchYouTubeVideos();
}, 300 * 60 * 1000);

// GET DATA EVERY 15 MINUTES
setInterval(async () => {
  await fetchBlogPosts();
  await fetchIntuneDocs();
}, 15 * 60 * 1000);

// TWEET RESULTS EVERY 30 MINUTES
setInterval(async () => {
  await tweetNewRows();
  await tweetNewCommits();
  await tweetYoutubeVideo();
}, 30 * 60 * 1000);

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

require("dotenv").config({ path: __dirname + "/.env" });
const express = require("express");
const app = express();
const port = process.env.PORT || 4000;
const { Configuration, OpenAIApi } = require("openai");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const { twitterClient } = require("./twitterClient.js");

const { fetchBlogPosts } = require("./scrape.js"); // import the function

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
        const summary = aiResponse.data.choices[0].message.content;
        const tweetText = `${title}:\n\n${summary}\n\n${author}`;
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

const interval = setInterval(tweetNewRows, 30 * 60 * 1000); // Poll the database every 30 minutes

// call the fetchBlogPosts function every minute
setInterval(async () => {
  await fetchBlogPosts();
}, 1 * 60 * 1000);

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

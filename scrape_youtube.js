const youtubefeeds = require("./youtubefeeds.json");
const { google } = require("googleapis");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const youtubeApiKey = process.env.YouTube_API_KEY;
const youtube = google.youtube({ version: "v3", auth: youtubeApiKey });

async function fetchYouTubeVideos() {
  try {
    for (const feed of youtubefeeds) {
      const { channelId, channelName } = feed;
      const {
        data: { items },
      } = await youtube.search.list({
        channelId,
        part: "id,snippet",
        order: "date",
        type: "video",
        maxResults: 1,
      });
      console.log(
        `Fetched ${items.length} videos from ${channelName} (${channelId})`
      );

      // Filter out videos that have already been added to the database
      const existingUrls = await prisma.YoutubeVideos.findMany({
        select: { url: true },
      });
      const newVideos = items.filter(
        (video) =>
          !existingUrls.some(
            (url) =>
              url.url === `https://www.youtube.com/watch?v=${video.id.videoId}`
          )
      );
      console.log(`Found ${newVideos.length} new videos`);

      // Save new videos to the database
      for (const video of newVideos) {
        const url = `https://www.youtube.com/watch?v=${video.id.videoId}`;
        const title = video.snippet.title;
        const author = video.snippet.channelTitle;
        const date = new Date(video.snippet.publishedAt);
        const tweeted = false;
        try {
          await prisma.YoutubeVideos.create({
            data: {
              url,
              title,
              author,
              tweeted,
              createdAt: new Date(date),
            },
          });
          console.log(`Added new video to database: ${title}`);
        } catch (error) {
          console.error(`Error adding video to database: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error fetching YouTube videos: ${error.message}`);
  }
}

// fetchYouTubeVideos().catch((err) => console.error(err));

module.exports = { fetchYouTubeVideos };

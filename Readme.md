# Intune Update Twitter Bot

This is a Node.js script that periodically checks RSS feeds for new blog posts and videos and tweets them automatically. It uses the Twitter API to send tweets, and the OpenAI API to summarize each blog post. The Youtube API is used to get the latest videos of Intune related Channels.

## Demo

You can see the bot live in action: [IntuneUpdate](https://twitter.com/IntuneUpdate)

## Requirements

- Node.js (v14 or higher)
- A Twitter Developer Account (to obtain Twitter API credentials)
- An OpenAI API key
- An Youtube API Key

## Installation

1. Clone or download this repository.
2. Run `npm install` to install dependencies.
3. Create a `.env` file in the root directory and add your Twitter and OpenAI API credentials as environment variables:

- TWITTER_CONSUMER_KEY=your_consumer_key
- TWITTER_CONSUMER_SECRET=your_consumer_secret
- TWITTER_ACCESS_TOKEN=your_access_token
- TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret
- OPENAI_API_KEY=your_api_key
- YouTube_API_KEY=your_api_key

4. Add RSS feed URLs and corresponding author names to the `feeds.json` file.
5. Run `node app.js` to start the bot.

## Configuration

The following configuration options are available:

- port: the port number for the Express.js server. Defaults to 8080.
- lastCheckedDates: an object that keeps track of the last time each feed was checked for new posts. You can prepopulate it with initial dates or leave it empty, in which case it will be populated automatically when the script runs.
- tweetNewPosts(): the function that sends tweets. You can customize the tweet text and formatting by editing this function.
- getSummary(): the function that summarizes each blog post. You can customize the summary prompt and AI model by editing this function.
- getNewPosts(): the function that fetches new posts from an RSS feed. You can customize the parser and filtering logic by editing this function.

## How it works

The script uses the `rss-parser` library to parse the RSS feeds and check for new blog posts. If a new post is found, it uses Cheerio to extract the text of the post, sends it to the OpenAI API to generate a summary, and tweets the summary along with the post title, link, and author.

It also checks for new Youtube Videos of Intune related Channels.

The script runs on a set interval (currently every 10 minutes) and keeps track of the last time each feed was checked to avoid duplicating tweets.

## Contributing

Pull requests are welcome! If you have any feature requests or bug reports, please open an issue on this repository.

## License

This project is licensed under the MIT License. See the `LICENSE` file for more information.

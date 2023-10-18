// Import the required libraries
const express = require('express');
const cheerio = require('cheerio');

// Create an Express.js app
const app = express();

// Create a webhook endpoint
app.post('/webhook', express.text(), (req, res) => {
  // Extract the email from the request
  const emailContent = req.body;

  // Load the email content into Cheerio
  const $ = cheerio.load(emailContent);

  // Extract the tracking link
  const trackingLink = $('a[href*="www.dhlparcel.nl/nl/zakelijk/zending-volgen/"]').attr('href');

  // Check the tracking link
  if (trackingLink) {
    console.log(`Tracking link: ${trackingLink}`);
  } else {
    console.log('Failed to extract tracking link');
  }

  // Send a response
  res.sendStatus(200);
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
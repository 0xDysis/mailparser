const Imap = require('imap');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const quotedPrintable = require('quoted-printable');
const WooCommerceAPI = require('woocommerce-api');
const cron = require('node-cron');
const url = require('url');
const querystring = require('querystring');

const WooCommerce = new WooCommerceAPI({
  url: 'https://kunstinjekeuken.nl/',
  consumerKey: 'ck_9fe153ae9e9563cb641c4545cf1b412a768c7a63',
  consumerSecret: 'cs_5260b4822ca6f34514b98637221ddcab3314498c',
  wpAPI: true,
  version: 'wc/v3'
});

let imap = new Imap({
  user: 'leila.haqi@gmail.com',
  password: 'diid ezch goue hayw',
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
  connTimeout: 10000
});

function openInbox(cb) {
  imap.openBox('INBOX', false, cb);
}

function checkEmails() {
  imap.once('ready', function () {
    openInbox(function (err, box) {
      if (err) {
        console.error('Error opening inbox:', err);
        return;
      }

      imap.search(['UNSEEN', ['FROM', 'info@probo.nl']], function (err, results) {
        if (err) throw err;

        if (results.length === 0) {
          console.log('No new emails to fetch');
          return; // Return from the function without doing anything
        }

        let f = imap.fetch(results, { bodies: '', markSeen: true });

        f.on('message', function (msg, seqno) {
          let prefix = '(#' + seqno + ') ';
          let actualTrackingLink; // Define actualTrackingLink here

          msg.on('body', function (stream, info) {
            let buffer = '';

            stream.on('data', function (chunk) {
              buffer += chunk.toString('utf8');
            });

            stream.once('end', function () {
              let cleanedBuffer = buffer.replace(/=\r\n/g, '');
              let decodedBuffer = quotedPrintable.decode(cleanedBuffer, 'utf8');
              let $ = cheerio.load(decodedBuffer);

              // Extract the reference number
              let referenceNumberElement = $('td:contains("Bestelling")');
              let referenceNumberMatch = referenceNumberElement.text().match(/\((#?\d+)[A-Z]{3}\)/);
              if (!referenceNumberMatch) {
                console.log('No reference number found');
                return;
              }
              let referenceNumber = referenceNumberMatch[1].replace('#', '');
              console.log('Reference number: ' + referenceNumber);

              // Extract the href attribute of the tracking link
              let trackingLinkElement = $('a[href*="mandrillapp.com/track/click"]:contains("Volgen")').filter((_, el) => {
                let href = $(el).attr('href');
                return href.includes('dhlparcel.nl') || href.includes('pakket.onbbezorgdienst.nl');
              });
              let encodedTrackingLink = trackingLinkElement.attr('href');

              if (encodedTrackingLink) {
                // Remove the '3D' prefix and replace '=3D' with '='
                let cleanedLink = encodedTrackingLink.replace(/^3D/, '').replace(/=3D/g, '=');
                let decodedTrackingLink = quotedPrintable.decode(cleanedLink, 'utf8');

                // Parse the decoded URL and extract the 'p' parameter
                let parsedUrl = url.parse(decodedTrackingLink, true);
                let pParam = parsedUrl.query.p;

                if (pParam) {
                  // Decode the 'p' parameter from Base64 to UTF-8, and then parse the resulting string
                  let decodedPParam = Buffer.from(pParam, 'base64').toString('utf8');
                  let parsedPParam = JSON.parse(decodedPParam);

                  if (parsedPParam.p) {
                    // Check if 'p' property exists
                    let innerPParam = JSON.parse(parsedPParam.p); // Parse the 'p' property as a JSON object

                    if (innerPParam.url) {
                      // Check if 'url' property exists
                      actualTrackingLink = innerPParam.url; // Use innerPParam.url as the actual tracking link
                      console.log('Actual tracking link: ' + actualTrackingLink);

                      // Fetch the order details
                      WooCommerce.get(`orders/${referenceNumber}`, function (err, data, res) {
                        if (err) throw err;

                        let order = JSON.parse(res);
                        if (order) {
                          let email = order.billing.email;
                          let billing_first_name = order.billing.first_name;

                          // Log the email and billing_first_name properties
                          console.log('Email:', email);
                          console.log('Billing first name:', billing_first_name);

                          let aTag = `<a href="${actualTrackingLink}">${actualTrackingLink}</a>`;

                          let transporter = nodemailer.createTransport({
                            service: 'gmail',
                            auth: {
                              user: 'kunstinjekeuken@gmail.com',
                              pass: 'ndwu mhwn mjro fvyo'
                            }
                          });

                          let mailOptions = {
                            from: 'kunstinjekeuken@gmail.com',
                            to: email,
                            subject: 'Je bestelling is onderweg',
                            html: ` <p>Hoi ${billing_first_name},</p>
                                    <p>Je bestelling is met de koerier mee. Zodra die vanavond in het depot is aangekomen kun je hem volgen via deze Track&amp;Trace code: ${aTag} </p>
                                    <p>Controleer hem meteen nadat hij is afgeleverd. Graag hoor ik binnen twee dagen na ontvangst of hij in goede orde is aangekomen.</p>
                                    <p>Ik wens je er alvast veel plezier mee! Je maakt mij heel blij met een voor en na foto シ</p>
                                    <div style="color: grey;">
                                    <p> --<br>
                                    <div style="line-height: 20px;"> Met vriendelijke groet,<br> Leila<br> <img src="https://i.imgur.com/jgVqcUZ.png" width="50" height="50" style="vertical-align: 0px;"> <p style="margin: 0;">Kunst in je keuken</p> </div>
                                    <a href="http://www.kunstinjekeuken.nl">kunstinjekeuken.nl</a> | <a href="https://www.instagram.com/kunstinjekeuken/">Instagram</a> | <a href="https://www.facebook.com/leila.kunstinjekeuken/">Facebook</a></p> `
                          };

                          transporter.sendMail(mailOptions, (error, info) => {
                            if (error) {
                              console.log(error);
                            } else {
                              console.log('Email sent: ' + info.response);
                            }
                          });
                        }
                      });
                    } else {
                      console.log('No url property found in innerPParam');
                    }
                  } else {
                    console.log('No p property found in parsedPParam');
                  }
                } else {
                  console.log('Could not extract tracking link from decoded URL');
                }
              } else {
                console.log('No href attribute found for tracking link');
              }
            });
          });
        });

        f.once('end', function () {
          imap.end();
        });
      });
    });
  });

  imap.once('error', function (err) {
    console.log(err);
  });

  imap.once('end', function () {
    console.log('Connection ended');
  });

  imap.connect();
}

cron.schedule('*/1 * * * *', checkEmails);
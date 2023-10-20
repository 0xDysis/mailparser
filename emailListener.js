const Imap = require('imap');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const util = require('util');
const quotedPrintable = require('quoted-printable');

let imap = new Imap({
  user: 'timmy.moreels@gmail.com',
  password: 'wgpt ungg iake tqbf',
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
  connTimeout: 10000 // Increase this as needed
});

function openInbox(cb) {
  imap.openBox('INBOX', true, cb);
}

imap.once('ready', function() {
  openInbox(function(err, box) {
    if (err) throw err;
    imap.search(['UNSEEN', ['FROM', 'dysishomer@gmail.com']], function(err, results) {
      if (err) throw err;
      let f = imap.fetch(results, { bodies: '' });
      f.on('message', function(msg, seqno) {
        let prefix = '(#' + seqno + ') ';
        msg.on('body', function(stream, info) {
          let buffer = '';
          stream.on('data', function(chunk) {
            buffer += chunk.toString('utf8');
          });
          stream.once('end', function() {
            let cleanedBuffer = buffer.replace(/=\r\n/g, '');
            let decodedBuffer = quotedPrintable.decode(cleanedBuffer);
            let $ = cheerio.load(decodedBuffer);

            let links = [];
            $('a').each((i, link) => {
              let href = $(link).attr('href');
              // Check if the href contains the specific string
              if (href && href.includes('https://www.dhlparcel.nl/nl/zakelijk/zending')) {
                // Create a properly formatted <a> tag
                let aTag = `<a href="${href}">${href}</a>`;
                // Add the <a> tag to the links array
                links.push(aTag);
              }
            });

            // Now 'links' contains all the links in the email
            // You can now send the tracking links to the customers
            let transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: {
                user: 'timmy.moreels@gmail.com',
                pass: 'wgpt ungg iake tqbf'
              }
            });
            let mailOptions = {
              from: 'timmy.moreels@gmail.com',
              to: 'dysiscypher@gmail.com',
              subject: 'Your tracking link',
              html: 'Here is your tracking link: ' + links[0] // replace this with the actual link
            };
            transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.log(error);
              } else {
                console.log('Email sent: ' + info.response);
              }
            });
          });
        });
      });
      f.once('end', function() {
        imap.end();
      });
    });
  });
});

imap.once('error', function(err) {
  console.log(err);
});

imap.once('end', function() {
  console.log('Connection ended');
});

imap.connect();

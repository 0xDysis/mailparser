const Imap = require('imap');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const quotedPrintable = require('quoted-printable');
const WooCommerceAPI = require('woocommerce-api');
const cron = require('node-cron');
const { URL, URLSearchParams } = require('url');

const WooCommerce = new WooCommerceAPI({
    url: 'https://kunstinjekeuken.nl/',
    consumerKey: 'ck_9fe153ae9e9563cb641c4545cf1b412a768c7a63',
    consumerSecret: 'cs_5260b4822ca6f34514b98637221ddcab3314498c',
    wpAPI: true,
    version: 'wc/v3'
});

let imap = new Imap({
    user: 'timmy.moreels@gmail.com',
    pass: 'xuoz eboq lhyc zouo',
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
  imap.once('ready', function() {
    openInbox(function(err, box) {
      if (err)  {
        console.error('Error opening inbox:', err);
        return;
      }
      imap.search(['UNSEEN', ['FROM', 'dysiscypher@gmail.com']], function(err, results) {
        if (err) throw err;
        if (results.length === 0) {
          console.log('No new emails to fetch');
          return;
        }
        let f = imap.fetch(results, { bodies: '', markSeen: true }); 
        f.on('message', function(msg, seqno) {
          msg.on('body', function(stream, info) {
            let buffer = '';
            stream.on('data', function(chunk) {
              buffer += chunk.toString('utf8');
            });
            stream.once('end', function() {
              let cleanedBuffer = buffer.replace(/=\r\n/g, '');
              let decodedBuffer = quotedPrintable.decode(cleanedBuffer, 'utf8'); 
              let $ = cheerio.load(decodedBuffer);
            
              let referenceNumberElement = $('td:contains("Referentie")').parent().find('td.pc-fb-font').last();
              let referenceNumber = referenceNumberElement.text().trim();
            
              console.log('Reference number: ' + referenceNumber);
            
              WooCommerce.get(`orders/${referenceNumber}`, function(err, data, res) {
                if (err) throw err;
            
                let order = JSON.parse(res);
                if (order) {
                  let email = order.billing.email;
                  let billing_first_name = order.billing.first_name;
            
                  let links = [];
                  $('a').each((i, link) => {
                    let href = $(link).attr('href');
                    if (href && href.startsWith('https://mandrillapp.com/track/click')) {
                      let parsedUrl = new URL(href);
                      let parsedQuery = new URLSearchParams(parsedUrl.search);
                      let decodedParam = Buffer.from(parsedQuery.get('p'), 'base64').toString('utf8');
                      let paramObject = JSON.parse(decodedParam);
                      let actualUrl = paramObject.url;
                      if (actualUrl.startsWith('https://track-trace.info/')) {
                        let aTag = `<a href="${actualUrl}">${actualUrl}</a>`;
                        links.push(aTag);
                      }
                    }
                  });
            
                  let transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: 'timmy.moreels@gmail.com',
                        pass: 'xuoz eboq lhyc zouo',
                    }
                  });
                  let mailOptions = {
                    from: 'timmy.moreels@gmail.com',
                    to: 'dysishomer@gmail.com',
                    subject: 'Je bestelling is onderweg',
                    html: `
                      <p>Hoi ${billing_first_name},</p>
                      <p>Je bestelling is met de koerier mee. Zodra die vanavond in het DHL depot is aangekomen kun je hem volgen via deze Track&amp;Trace code: <a ${links[0]}</a>
                      </p>
                      <p>Controleer hem meteen nadat hij is afgeleverd. Graag hoor ik binnen twee dagen na ontvangst of hij in goede orde is aangekomen.</p>
                      <p>Ik wens je er alvast veel plezier mee! Je maakt mij heel blij met een voor en na foto シ</p>
                      <div style="color: grey;">
                      <p>
                        --<br>
                        <div style="line-height: 20px;">
                        Met vriendelijke groet,<br>
                        Leila<br>
                    <img src="https://i.imgur.com/jgVqcUZ.png" width="50" height="50" style="vertical-align: 0px;">
                        <p style="margin: 0;">Kunst in je keuken</p>
                       
                      </div>
                    
                    
                      <a href="http://www.kunstinjekeuken.nl">kunstinjekeuken.nl</a> | <a href="https://www.instagram.com/kunstinjekeuken/">Instagram</a> | <a href="https://www.facebook.com/leila.kunstinjekeuken/">Facebook</a></p>
                      
                    `
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
}
cron.schedule('*/1 * * * *', checkEmails);
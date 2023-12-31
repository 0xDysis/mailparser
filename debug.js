const Imap = require('imap');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const quotedPrintable = require('quoted-printable');
const WooCommerceAPI = require('woocommerce-api');

const WooCommerce = new WooCommerceAPI({
  url: 'https://test.kunstinjekeuken.nl/',
  consumerKey: 'c',
  consumerSecret: 'c',
  wpAPI: true,
  version: 'wc/v3'
});

let imap = new Imap({
  user: 'timmy.moreels@gmail.com',
  password: 'wgpt ungg iake tqbf',
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
  connTimeout: 10000
});

function openInbox(cb) {
  imap.openBox('INBOX', false, cb);
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
            let decodedBuffer = quotedPrintable.decode(cleanedBuffer, 'utf8'); 
            let $ = cheerio.load(decodedBuffer);
          
            
            let referenceNumberElement = $('p:contains("Referentie")').find('strong').first();
            let referenceNumber = referenceNumberElement.text().replace('#', '');
          
           
            console.log('Reference number: ' + referenceNumber);
          
            
            referenceNumber = referenceNumber.replace(/\D+$/, '');
          
            
            WooCommerce.get(`orders/${referenceNumber}`, function(err, data, res) {
              if (err) throw err;
          
              let order = JSON.parse(res);
              if (order) {
                let email = order.billing.email;
          
                
          
                
          
                
          
                

                let links = [];
                $('a').each((i, link) => {
                  let href = $(link).attr('href');
                  if (href && href.includes('https://www.dhlparcel.nl/nl/zakelijk/zending')) {
                    let aTag = `<a href="${href}">${href}</a>`;
                    links.push(aTag);

                    imap.seq.addFlags(seqno, '\\Seen', function(err) {
                      if (err) {
                        console.log('Error marking email as read:', err);
                      } else {
                        console.log('Email marked as read');
                      }
                    });
                  }
                });

                
                console.log('Email address: ' + email);
                console.log('Reference number: ' + referenceNumber);
                console.log('Tracking link: ' + links[0]);
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

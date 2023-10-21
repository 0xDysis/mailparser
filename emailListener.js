const Imap = require('imap');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const quotedPrintable = require('quoted-printable');
const WooCommerceAPI = require('woocommerce-api');

const WooCommerce = new WooCommerceAPI({
  url: 'https://test.kunstinjekeuken.nl/',
  consumerKey: 'ck_6d6a86355ba932b80e23257c36a0f11f1b6b5a94',
  consumerSecret: 'cs_f1e81086ddbec4fcf2b13e05f83aa9b14c957266',
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
      let f = imap.fetch(results, { bodies: '', markSeen: true }); // This will mark the emails as seen
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
                let billing_first_name = order.billing.first_name; // Extract the billing_first_name from the order object
          
                let links = [];
                $('a').each((i, link) => {
                  let href = $(link).attr('href');
                  if (href && href.includes('https://www.dhlparcel.nl/nl/zakelijk/zending')) {
                      let aTag = `<a href="${href}">${href}</a>`;
                      links.push(aTag);
                  }
              });
              
              
              

                let transporter = nodemailer.createTransport({
                  service: 'gmail',
                  auth: {
                    user: 'timmy.moreels@gmail.com',
                    pass: 'wgpt ungg iake tqbf'
                  }
                });
                let mailOptions = {
                  from: 'timmy.moreels@gmail.com',
                  to: email,
                  subject: 'Je bestelling is onderweg',
                  html: `
                    <p>Hoi ${billing_first_name},</p>
                    <p>Je bestelling is met de koerier mee. Zodra die vanavond in het DHL depot is aangekomen kun je hem volgen via deze Track&amp;Trace code:<a ${links[0]}</a>
                    </p>
                    <p>Controleer hem meteen nadat hij is afgeleverd. Graag hoor ik binnen twee dagen na ontvangst of hij in goede orde is aangekomen.</p>
                    <p>Ik wens je er alvast veel plezier mee! Je maakt mij heel blij met een voor en na foto シ</p>
                    <p>--<br>
                    Met vriendelijke groet,<br>
                    Leila<br>
                    M 06 242 04 138<br>
                    ​<br>
                    Kunst in je keuken<br>
                    Kortrijk 83 | 1066 TB Amsterdam<br>
                    <a href="http://www.kunstinjekeuken.nl">www.kunstinjekeuken.nl</a> | <a href="https://www.instagram.com/kunstinjekeuken/">Instagram</a> | <a href="https://www.facebook.com/leila.kunstinjekeuken/">Facebook</a></p>
                    
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

'use strict';

const template = require('../views/email.html');

class Email {
  constructor(ses, from) {
    this.ses = ses;
    this.from = from;
  }

  send(to, subject, header, content, buttonUrl = null, buttonText = null) {
    return this.ses.sendEmail({
      Source: this.from,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: {
            Data: template({
              header,
              content,
              buttonUrl,
              buttonText,
            }),
            Charset: 'utf-8',
          },
        },
      },
    }).promise();
  }
}

export default Email;

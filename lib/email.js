'use strict';

const aws = require('aws-sdk');
const template = require('../views/email.html');

const email = module.exports;
let region;
let from;

email.init = function (regionIn, fromIn) {
  region = regionIn;
  from = fromIn;
};

email.send = (to, subject, header, content, buttonUrl = null,
  buttonText = null) => {
  aws.config.setPromisesDependency(Promise);
  const ses = new aws.SES({ apiVersion: '2010-12-01', region });
  return ses.sendEmail({
    Source: from,
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
};

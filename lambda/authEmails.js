'use strict';

require('longjohn');
require('babel-polyfill');
// const template = require('../../views/email.html');

module.exports.emails = (event, context, callback) => {
  const newEvent = event;
  switch (event.triggerSource) {
    case 'CustomMessage_SignUp':
      newEvent.response.emailSubject = 'Welcome to Keboola Developer Portal';
      /* newEvent.response.emailMessage = template({
        header: 'Welcome to Keboola Developer Portal',
        content: `Thank you for signing up. Confirm your email using code
        <strong>${event.request.codeParameter}</strong> or directly by clicking on the button:`,
        buttonUrl: `${process.env.API_ENDPOINT}/auth/confirm/${event.userName}`
        +`/${event.request.codeParameter}`,
        buttonText: 'Confirm your email',
      });*/
      newEvent.response.emailMessage = `Thank you for signing up. Confirm your email using this link: ${process.env.API_ENDPOINT}/auth/confirm/${event.userName}/${event.request.codeParameter}`;
      break;
    case 'CustomMessage_ForgotPassword':
      newEvent.response.emailSubject = 'Forgot Password to Keboola Developer Portal';
      newEvent.response.emailMessage = `Your confirmation code is ${event.request.codeParameter}`;
      break;
    case 'CustomMessage_ResendCode':
      newEvent.response.emailSubject = 'Confirmation code for Keboola Developer Portal';
      newEvent.response.emailMessage = `Confirm your email using this link: ${process.env.API_ENDPOINT}/auth/confirm/${event.userName}/${event.request.codeParameter}`;
      break;
    default:
  }
  callback(null, newEvent);
};

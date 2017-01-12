FROM node:alpine

ENV SERVERLESS_VERSION 1.2.1

# aws cli
RUN apk add --update python py-pip
RUN pip install awscli

# serverless
RUN npm install -g serverless@${SERVERLESS_VERSION}

# yarn
RUN npm install -g yarn

# working directory
ADD ./ /code
WORKDIR /code

RUN yarn install

# deploy
CMD node ./scripts/create-env.js ./env.yml && sls deploy
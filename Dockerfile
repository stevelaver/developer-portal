FROM node:alpine

ENV SERVERLESS_VERSION 1.2.1

# aws cli
RUN apk add --update \
    python \
    py-pip
RUN pip install awscli

# yarn
RUN npm install -g yarn

# serverless
RUN npm install -g serverless@${SERVERLESS_VERSION}

ADD ./ /code
WORKDIR /code


RUN yarn install
CMD sls deploy
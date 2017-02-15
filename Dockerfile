FROM node:alpine

# aws cli
RUN apk add --update python py-pip git
RUN pip install awscli

# serverless
RUN npm install -g serverless@1.7

# yarn
RUN npm install -g yarn

# working directory
ADD ./ /code
WORKDIR /code

RUN yarn install

# deploy
CMD node ./scripts/create-env.js ./env.yml && sls deploy
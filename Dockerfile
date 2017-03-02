FROM node:alpine

# aws cli
RUN apk add --update python py-pip git
RUN pip install awscli

# serverless
RUN npm install -g serverless@1.7

# yarn
ENV PATH /root/.yarn/bin:$PATH
RUN apk update \
  && apk add curl bash binutils tar \
  && rm -rf /var/cache/apk/* \
  && /bin/bash \
  && touch ~/.bashrc \
  && curl -o- -L https://yarnpkg.com/install.sh | bash \
  && apk del curl tar binutils

# working directory
ADD ./ /code
WORKDIR /code

RUN yarn install

# deploy
CMD node ./scripts/create-env.js ./env.yml && sls deploy
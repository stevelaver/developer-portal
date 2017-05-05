FROM amazonlinux

# aws cli
#RUN apk add --update python py-pip git
#RUN pip install awscli

# node + yarn
RUN yum -y groupinstall 'Development Tools'
RUN curl --silent --location https://rpm.nodesource.com/setup_6.x | bash -
RUN curl --silent https://dl.yarnpkg.com/rpm/yarn.repo > /etc/yum.repos.d/yarn.repo
RUN yum -y install nodejs npm yarn python27

# serverless
RUN npm install -g serverless@1.12

# sharp
RUN npm install -g node-gyp

# working directory
ADD ./ /code
WORKDIR /code

RUN yarn install

# deploy
CMD node ./scripts/create-env.js ./env.yml && sls deploy

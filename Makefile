all: pre-deploy deploy post-deploy

pre-deploy:
	node scripts/pre-deploy.js

deploy:
	sls deploy

post-deploy:
	node scripts/post-deploy.js

remove:
	sls remove
	node scripts/remove-setup.js

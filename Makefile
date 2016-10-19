all: pre-deploy deploy post-deploy

pre-deploy:
	node scripts/pre-deploy.js

deploy:
	sls deploy

post-deploy:
	node scripts/post-deploy.js save-cloudformation-output
	node scripts/post-deploy.js init-database
	node scripts/post-deploy.js update-cognito
	node scripts/post-deploy.js subscribe-logs

remove:
	sls remove
	node scripts/remove-setup.js delete-cognito
	node scripts/remove-setup.js delete-logs

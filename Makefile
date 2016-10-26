all: pre-deploy deploy save-output init-database update-cognito subscribe-logs finish-deploy

pre-deploy:
	node scripts/pre-deploy.js

deploy:
	sls deploy

save-output:
	node scripts/post-deploy.js save-cloudformation-output

init-database:
	node scripts/post-deploy.js init-database

update-cognito:
	node scripts/post-deploy.js update-cognito

subscribe-logs:
	node scripts/post-deploy.js subscribe-logs

finish-deploy:
	sls deploy
	cat ./env.yml

remove:
	sls remove
	node scripts/remove-setup.js delete-cognito
	node scripts/remove-setup.js delete-logs

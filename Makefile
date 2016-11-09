install: pre-deploy deploy-sls save-output init-database update-cognito subscribe-logs finish-deploy-sls

pre-deploy:
	node scripts/setup.js save-env
	node scripts/setup.js save-account-id
	node scripts/setup.js create-vpc
	node scripts/setup.js add-email-policy
	node scripts/setup.js create-cognito

deploy-sls:
	sls deploy

save-output:
	node scripts/setup.js save-cloudformation-output

init-database:
	node scripts/setup.js init-database

update-cognito:
	node scripts/setup.js update-cognito

subscribe-logs:
	node scripts/setup.js subscribe-logs

finish-deploy-sls:
	sls deploy
	cat ./env.yml



remove:
	node scripts/setup.js empty-bucket
	sls remove
	node scripts/setup.js delete-cognito
	node scripts/setup.js delete-vpc
	node scripts/setup.js delete-logs

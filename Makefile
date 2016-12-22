install: pre-deploy deploy-sls deploy-after-sls finish-deploy-sls

pre-deploy:
	node scripts/setup.js save-env
	node scripts/setup.js save-account-id
	node scripts/setup.js create-vpc
	node scripts/setup.js add-email-policy
	node scripts/setup.js create-cognito

deploy-sls:
	sls deploy

deploy-after-sls:
    node scripts/setup.js save-cloudformation-output
    node scripts/setup.js init-database
    node scripts/setup.js update-cognito
    node scripts/setup.js subscribe-logs

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

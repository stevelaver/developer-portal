install: deploy-before-sls deploy-sls deploy-after-sls finish-deploy-sls

deploy-before-sls:
	node scripts/setup.js save-env
	node scripts/setup.js save-account-id
	node scripts/setup.js create-vpc
	node scripts/setup.js add-email-policy
	node scripts/setup.js create-cognito

deploy-sls:
	env DB_MIGRATE_SKIP=1 sls deploy

deploy-after-sls:
	node scripts/setup.js save-cloudformation-output
	node scripts/setup.js update-cognito
	sls deploy # run with migrations now

save-output:
	node scripts/setup.js save-cloudformation-output

update-cognito:
	node scripts/setup.js update-cognito

finish-deploy-sls:
	sls deploy
	cat ./env.yml



remove:
	node scripts/setup.js empty-bucket
	sls remove
	node scripts/setup.js delete-cognito
	node scripts/setup.js delete-vpc
	node scripts/setup.js delete-logs

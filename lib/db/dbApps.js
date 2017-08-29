'use strict';

const _ = require('lodash');

class DbApps {
  constructor(rds, err) {
    this.rds = rds;
    this.err = err;
  }

  insertApp(paramsIn) {
    return this.formatAppInput(paramsIn)
      .then(paramsOut => this.rds.queryAsync('INSERT INTO apps SET ?', paramsOut)
        .then(() => {
          const params = paramsOut;
          delete params.vendor;
          return this.rds.queryAsync('INSERT INTO appVersions SET ?', params);
        }));
  }

  copyAppToVersion(id, userEmail) {
    return this.rds.queryAsync('SELECT * FROM apps WHERE id = ?', [id])
      .spread((res) => {
        const result = res;
        if (!result) {
          throw this.err.notFound(`App ${id} does not exist`);
        } else {
          delete result.vendor;
          delete result.createdOn;
          delete result.createdBy;
          return result;
        }
      })
      .then((appIn) => {
        const app = appIn;
        app.createdBy = userEmail;
        return this.rds.queryAsync('INSERT INTO appVersions SET ?', app);
      });
  }

  updateApp(id, paramsIn, userEmail) {
    return this.formatAppInput(paramsIn)
      .then((paramsOut) => {
        if (_.size(paramsOut)) {
          return this.rds.beginTransactionAsync()
            .then(() => this.rds.queryAsync('UPDATE apps SET ?, version = version + 1 WHERE id = ?', [paramsOut, id]))
            .then(() => this.copyAppToVersion(id, userEmail))
            .then(() => this.rds.commitAsync());
        }
      });
  }

  addAppIcon(id) {
    return this.rds.beginTransactionAsync()
      .then(() => this.rds.queryAsync(
        'UPDATE apps ' +
        'SET icon32 = CONCAT(?, version + 1, ?), icon64 = CONCAT(?, version + 1, ?), version = version + 1 ' +
        'WHERE id = ?',
        [`${id}/32/`, '.png', `${id}/64/`, '.png', id]
      ))
      .then(() => this.copyAppToVersion(id, 'upload'))
      .then(() => this.rds.queryAsync('SELECT MAX(version) AS version FROM apps WHERE id = ?', [id]))
      .spread(res => this.rds.commitAsync()
        .then(() => res.version));
  }

  formatAppInput(appIn, checkStacks = true) {
    const app = _.clone(appIn);
    return new Promise((resolve) => {
      if (app.uiOptions) {
        app.uiOptions = JSON.stringify(app.uiOptions);
      }
      if (app.imageParameters) {
        app.imageParameters = JSON.stringify(app.imageParameters);
      }
      if (app.testConfiguration) {
        app.testConfiguration = JSON.stringify(app.testConfiguration);
      }
      if (app.configurationSchema) {
        app.configurationSchema = JSON.stringify(app.configurationSchema);
      }
      if (app.actions) {
        app.actions = JSON.stringify(app.actions);
      }
      if (app.emptyConfiguration) {
        app.emptyConfiguration = JSON.stringify(app.emptyConfiguration);
      }
      if (app.loggerConfiguration) {
        app.loggerConfiguration = JSON.stringify(app.loggerConfiguration);
      }
      resolve();
    })
      .then(() => {
        if (checkStacks) {
          return this.rds.queryAsync('SELECT name FROM stacks ORDER BY name')
            .then(res => res.map(r => r.name));
        }
        return null;
      })
      .then((stacks) => {
        if (app.permissions) {
          _.each(app.permissions, (p) => {
            if (!_.includes(stacks, p.stack)) {
              throw this.err.unprocessable(`Stack ${p.stack} is not supported`);
            }
          });
          app.permissions = JSON.stringify(app.permissions);
        }
      })
      .then(() => {
        if (_.has(app, 'repository.type')) {
          app.repoType = _.get(app, 'repository.type');
        }
        if (_.has(app, 'repository.uri')) {
          app.repoUri = _.get(app, 'repository.uri');
        }
        if (_.has(app, 'repository.tag')) {
          app.repoTag = _.get(app, 'repository.tag');
        }
        if (_.has(app, 'repository.options')) {
          app.repoOptions = app.repository.options ? JSON.stringify(app.repository.options) : null;
        }
        delete app.repository;

        if (_.isObject(app.vendor)) {
          app.vendor = app.vendor.id;
        }

        const allowedKeys = ['id', 'vendor', 'isPublic', 'createdOn', 'createdBy', 'deletedOn',
          'isDeprecated', 'expiredOn', 'replacementApp', 'version', 'name', 'type', 'repoType',
          'repoUri', 'repoTag', 'repoOptions', 'shortDescription', 'longDescription',
          'licenseUrl', 'documentationUrl', 'requiredMemory', 'processTimeout', 'encryption',
          'network', 'defaultBucket', 'defaultBucketStage', 'forwardToken', 'forwardTokenDetails',
          'injectEnvironment', 'cpuShares', 'uiOptions', 'imageParameters', 'testConfiguration',
          'configurationSchema', 'configurationDescription', 'configurationFormat',
          'emptyConfiguration', 'actions', 'fees', 'limits', 'logger', 'loggerConfiguration',
          'stagingStorageInput', 'icon32', 'icon64', 'legacyUri', 'permissions',
          'publishRequestOn', 'publishRequestBy', 'publishRequestRejectionReason'];
        _.each(app, (val, key) => {
          if (!_.includes(allowedKeys, key)) {
            delete app[key];
          }
        });

        return app;
      });
  }
}

export default DbApps;

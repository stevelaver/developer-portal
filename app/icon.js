const Promise = require('bluebird');

class Icon {
  constructor(s3, db, env, err) {
    this.s3 = s3;
    this.db = db;
    this.env = env;
    this.err = err;
  }

  getUploadLink(Identity, id, vendor, user) {
    return Identity.checkVendorPermissions(user, vendor)
      .then(() => this.db.checkAppAccess(id, vendor))
      .then(() => {
        const s3 = this.s3;
        const getSignedUrl = Promise.promisify(s3.getSignedUrl.bind(s3));
        const validity = 3600;
        return getSignedUrl('putObject', {
          Bucket: this.env.S3_BUCKET,
          Key: `icons/${id}/upload.png`,
          Expires: validity,
          ContentType: 'image/png',
          ACL: 'public-read',
        })
          .then(res => ({
            link: res,
            expiresIn: validity,
          }));
      });
  }

  upload(jimp, id, bucket, sourceKey) {
    let version;
    return this.s3.headObject({
      Bucket: bucket,
      Key: sourceKey,
    }).promise()
      .catch((err) => {
        if (err.code === 'NotFound' || err.code === 'Forbidden') {
          throw this.err.notFound();
        }
        throw err;
      })
      .then(() => this.s3.copyObject({
        CopySource: `${bucket}/${sourceKey}`,
        Bucket: bucket,
        Key: `icons/${id}/latest.png`,
        ACL: 'public-read',
      }).promise())
      .then(() => this.s3.deleteObject(
        {
          Bucket: bucket,
          Key: sourceKey,
        }
      ).promise())
      .then(() => this.db.addAppIcon(id))
      .then((v) => {
        version = v;
      })
      .then(() => this.s3.getObject({
        Bucket: bucket,
        Key: `icons/${id}/latest.png`,
      }).promise())
      .then(data => jimp.read(data.Body))
      .then(image => new Promise((res, rej) => {
        image.resize(64, 64).getBuffer(jimp.MIME_PNG, (err, data) => {
          if (err) {
            rej(err);
          }
          res(data);
        });
      }))
      .then(buffer => this.s3.putObject({
        Body: buffer,
        Bucket: bucket,
        ContentType: 'image/png',
        Key: `icons/${id}/64/${version}.png`,
        ACL: 'public-read',
      }).promise())
      .then(() => this.s3.getObject({
        Bucket: bucket,
        Key: `icons/${id}/latest.png`,
      }).promise())
      .then(data => jimp.read(data.Body))
      .then(image => new Promise((res, rej) => {
        image.resize(32, 32).getBuffer(jimp.MIME_PNG, (err, data) => {
          if (err) {
            rej(err);
          }
          res(data);
        });
      }))
      .then(buffer => this.s3.putObject({
        Body: buffer,
        Bucket: bucket,
        ContentType: 'image/png',
        Key: `icons/${id}/32/${version}.png`,
        ACL: 'public-read',
      }).promise());
  }
}

export default Icon;

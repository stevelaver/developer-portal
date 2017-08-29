
function UserError(message) {
  this.message = message;
  const lastPart = new Error().stack.match(/[^\s]+$/);
  this.stack = `${this.name} at ${lastPart}`;
}
Object.setPrototypeOf(UserError, Error);
UserError.prototype = Object.create(Error.prototype);
UserError.prototype.name = 'UserError';
UserError.prototype.code = 400;
UserError.prototype.type = null;
UserError.prototype.message = 'User Error';
UserError.prototype.constructor = UserError;

module.exports = UserError;

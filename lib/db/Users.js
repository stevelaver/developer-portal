'use strict';

class DbUsers {
  constructor(rds, err) {
    this.rds = rds;
    this.err = err;
  }

  createUser(paramsIn) {
    return this.rds.queryAsync('INSERT INTO users SET ?', paramsIn);
  }
}

export default DbUsers;

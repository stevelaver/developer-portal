'use strict';

import Validation from '../../lib/validation';

const expect = require('unexpected');
const joi = require('joi');
const error = require('../../lib/error');

const validation = new Validation(joi, error);

const expectOk = (res) =>
  expect(res.error, 'to be null');

const expectFail = (res) =>
  expect(res.error, 'to be a', Error);

const testOk = (rule, value) =>
  expectOk(joi.validate({ test: value }, { test: rule }));

const testFail = (rule, value) =>
  expectFail(joi.validate({ test: value }, { test: rule }));

const testMissingOk = (rule) =>
  expectOk(joi.validate({ }, { test: rule }));


describe('Validation', () => {
  describe('App schema', () => {
    it('createAppSchema', () => {
      const schema = validation.createAppSchema();
      // Missing required
      expectFail(joi.validate({
        test: 'value'
      }, schema));
      // Wrong type
      expectFail(joi.validate({
        id: 'id3',
        name: 'Test',
        type: 'nonsense'
      }, schema));
      // Cannot set isPublic
      expectFail(joi.validate({
        id: 'id3',
        name: 'Test',
        type: 'writer',
        isPublic: true,
      }, schema));
      // Cannot set vendor
      expectFail(joi.validate({
        id: 'id3',
        name: 'Test',
        type: 'writer',
        vendor: 'x',
      }, schema));
      // Cannot set isApproved
      expectFail(joi.validate({
        id: 'id3',
        name: 'Test',
        type: 'writer',
        isApproved: true,
      }, schema));
      // Cannot set legacyUri
      expectFail(joi.validate({
        id: 'id3',
        name: 'Test',
        type: 'writer',
        legacyUri: 'x',
      }, schema));
      // Cannot set icon32
      expectFail(joi.validate({
        id: 'id3',
        name: 'Test',
        type: 'writer',
        icon32: 'x',
      }, schema));
      expectOk(joi.validate({
        id: 'id3',
        name: 'Test',
        type: 'writer'
      }, schema));
    });

    it('updateAppSchema', () => {
      const schema = validation.updateAppSchema();
      // Cannot set isPublic
      expectFail(joi.validate({
        name: 'Test',
        type: 'writer',
        isPublic: true,
      }, schema));
      // Cannot set id
      expectFail(joi.validate({
        id: 'id3',
        name: 'Test',
        type: 'writer',
      }, schema));
      expectOk(joi.validate({
        name: 'Test',
        type: 'writer'
      }, schema));
      // Cannot set vendor
      expectFail(joi.validate({
        vendor: 'x',
      }, schema));
      // Cannot set isApproved
      expectFail(joi.validate({
        isApproved: true,
      }, schema));
      // Cannot set legacyUri
      expectFail(joi.validate({
        legacyUri: 'x',
      }, schema));
      // Cannot set icon32
      expectFail(joi.validate({
        icon32: 'x',
      }, schema));
      // Cannot set icon64
      expectFail(joi.validate({
        icon64: 'x',
      }, schema));
      // Cannot set createdBy
      expectFail(joi.validate({
        createdBy: 'x',
      }, schema));
      // Cannot set createdOn
      expectFail(joi.validate({
        createdOn: 'x',
      }, schema));
      // Cannot set version
      expectFail(joi.validate({
        version: 'x',
      }, schema));
      expectOk(joi.validate({
        name: 'Test',
        type: 'writer'
      }, schema));
    });

    it('updateApprovedAppSchema', () => {
      const schema = validation.updateApprovedAppSchema();
      // Can set isPublic
      expectOk(joi.validate({
        name: 'Test',
        type: 'writer',
        isPublic: true,
      }, schema));
      // Cannot set id
      expectFail(joi.validate({
        id: 'id3',
        name: 'Test',
        type: 'writer',
      }, schema));
      // Cannot set forwardToken
      expectFail(joi.validate({
        forwardToken: true,
      }, schema));
      // Cannot set forwardTokenDetails
      expectFail(joi.validate({
        forwardTokenDetails: true,
      }, schema));
      // Cannot set injectEnvironment
      expectFail(joi.validate({
        injectEnvironment: true,
      }, schema));
      // Cannot set cpuShares
      expectFail(joi.validate({
        cpuShares: 1024,
      }, schema));
      // Cannot set requiredMemory
      expectFail(joi.validate({
        requiredMemory: '5GB',
      }, schema));
      // Cannot set processTimeout
      expectFail(joi.validate({
        processTimeout: 250,
      }, schema));
      // Cannot set vendor
      expectFail(joi.validate({
        vendor: 'x',
      }, schema));
      // Cannot set isApproved
      expectFail(joi.validate({
        isApproved: true,
      }, schema));
      // Cannot set legacyUri
      expectFail(joi.validate({
        legacyUri: 'x',
      }, schema));
      // Cannot set icon32
      expectFail(joi.validate({
        icon32: 'x',
      }, schema));
      expectOk(joi.validate({
        name: 'Test',
        type: 'writer'
      }, schema));
    });

    it('adminAppSchema', () => {
      const schema = validation.adminAppSchema();
      // Cannot set id
      expectFail(joi.validate({
        id: 'id3',
        name: 'Test',
        type: 'writer',
      }, schema));
      expectOk(joi.validate({
        isPublic: true,
        forwardToken: true,
        forwardTokenDetails: true,
        injectEnvironment: true,
        cpuShares: 1024,
        requiredMemory: '5GB',
        processTimeout: 250,
        vendor: 'x',
        isApproved: true,
        legacyUri: 'x',
      }, schema));
    });

    it('commonAppSchema', () => {
      const schema = validation.commonAppSchema();
      // Repository type
      expectFail(joi.validate({
        repository: {
          type: 'x'
        },
      }, schema));
      expectOk(joi.validate({
        repository: {
          type: 'ecr'
        },
        permissions: [
          {
            stack: 'xx'
          },
          {
            projects: [1, 2],
            stack: 'xy'
          }
        ]
      }, schema));
    });

    it('adminCreateVendorSchema', () => {
      const schema = validation.adminCreateVendorSchema();
      // Address missing
      expectFail(joi.validate({
        id: 'id',
        name: 'vendor name',
        email: 'right@email.com',
      }, schema));
      // Email format
      expectFail(joi.validate({
        id: 'id',
        name: 'vendor name',
        address: 'vendor address',
        email: 'wrong',
      }, schema));
      expectOk(joi.validate({
        id: 'id',
        name: 'vendor name',
        address: 'vendor address',
        email: 'right@email.com',
      }, schema));
    });
  });

  describe('Validation Functions', () => {
    it('validateForbidden', () => {
      testFail(validation.validateForbidden('t'), 3);
      testMissingOk(validation.validateForbidden('t'));
    });

    it('validateBoolean', () => {
      testFail(validation.validateBoolean('t'), 3);
      testFail(validation.validateBoolean('t'), 'yes');
      testFail(validation.validateBoolean('t'), ['x']);
      testFail(validation.validateBoolean('t'), { x: 'y' });
      testOk(validation.validateBoolean('t'), 'false');
      testOk(validation.validateBoolean('t'), false);
      testOk(validation.validateBoolean('t'), true);
      testMissingOk(validation.validateBoolean('t'));
    });

    it('validateString', () => {
      testFail(validation.validateString('t'), 3);
      testFail(validation.validateString('t'), ['x']);
      testFail(validation.validateString('t'), { x: 'y' });
      testOk(validation.validateString('t'), 'tdfsdsfds');
      testMissingOk(validation.validateString('t'));
    });

    it('validateStringMaxLength', () => {
      testFail(validation.validateStringMaxLength('t', 3), 3);
      testFail(validation.validateStringMaxLength('t', 3), ['x']);
      testFail(validation.validateStringMaxLength('t', 3), { x: 'y' });
      testFail(validation.validateStringMaxLength('t', 3), 'aksfjlsdkfjsdkjflkdsjflkdsjkldsjkl');
      testOk(validation.validateStringMaxLength('t', 10), 'tdfsdsfds');
      testMissingOk(validation.validateStringMaxLength('t', 2));
    });

    it('validateStringUri', () => {
      testFail(validation.validateStringUri('t'), 3);
      testFail(validation.validateStringUri('t'), ['x']);
      testFail(validation.validateStringUri('t'), { x: 'y' });
      testFail(validation.validateStringUri('t'), new Array(300).join('x'));
      testOk(validation.validateStringUri('t'), 'tdfsdsfds');
      testMissingOk(validation.validateStringUri('t'));
    });

    it('validateInteger', () => {
      testFail(validation.validateInteger('t'), 'fdsfdsf');
      testFail(validation.validateInteger('t'), ['x']);
      testFail(validation.validateInteger('t'), { x: 'y' });
      testOk(validation.validateInteger('t'), 3);
      testMissingOk(validation.validateInteger('t'));
    });

    it('validateObject', () => {
      testFail(validation.validateObject('t'), 'fdsfdsf');
      testFail(validation.validateObject('t'), ['x']);
      testFail(validation.validateObject('t'), 3);
      testOk(validation.validateObject('t'), { x: 'y' });
      testMissingOk(validation.validateObject('t'));
    });

    it('validateEnum', () => {
      testFail(validation.validateEnum('t', ['y', 'z']), 'fdsfdsf');
      testFail(validation.validateEnum('t', ['y', 'z']), ['x']);
      testFail(validation.validateEnum('t', ['y', 'z']), 3);
      testOk(validation.validateEnum('t', ['y', 'z']), 'y');
      testMissingOk(validation.validateEnum('t', ['y', 'z']));
    });

    it('validateArray', () => {
      testFail(validation.validateArray('t'), 'fdsfdsf');
      testFail(validation.validateArray('t'), { x: 'y' });
      testFail(validation.validateArray('t'), 3);
      testOk(validation.validateArray('t'), ['x']);
      testMissingOk(validation.validateArray('t'));
    });
  });
});

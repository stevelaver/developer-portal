SET foreign_key_checks = 0;

DROP TABLE IF EXISTS vendors;
CREATE TABLE `vendors` (
  `id` varchar(32) NOT NULL,
  `name` varchar(128) NOT NULL,
  `address` varchar(255) NOT NULL,
  `email` varchar(128) NOT NULL,
  `createdOn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `isPublic` tinyint(1) unsigned NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS stacks;
CREATE TABLE `stacks` (
  `name` varchar(128) NOT NULL DEFAULT '',
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS apps;
CREATE TABLE `apps` (
  `id` varchar(128) NOT NULL,
  `vendor` varchar(32) NOT NULL,
  `isApproved` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `isPublic` int(1) unsigned NOT NULL DEFAULT '1',
  `createdOn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` varchar(128) DEFAULT NULL,
  `version` int(10) unsigned NOT NULL DEFAULT '1',
  `name` varchar(128) NOT NULL,
  `type` varchar(20) DEFAULT NULL,
  `repoType` varchar(20) DEFAULT NULL,
  `repoUri` varchar(128) DEFAULT NULL,
  `repoTag` varchar(20) DEFAULT NULL,
  `repoOptions` json DEFAULT NULL,
  `shortDescription` text,
  `longDescription` text,
  `licenseUrl` varchar(255) DEFAULT NULL,
  `documentationUrl` varchar(255) DEFAULT NULL,
  `requiredMemory` varchar(10) DEFAULT NULL,
  `processTimeout` int(10) unsigned DEFAULT NULL,
  `encryption` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `defaultBucket` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `defaultBucketStage` enum('in','out') DEFAULT NULL,
  `forwardToken` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `forwardTokenDetails` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `injectEnvironment` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `cpuShares` int(10) unsigned DEFAULT NULL,
  `uiOptions` json DEFAULT NULL,
  `imageParameters` json DEFAULT NULL,
  `testConfiguration` json DEFAULT NULL,
  `configurationSchema` json DEFAULT NULL,
  `configurationDescription` text,
  `configurationFormat` enum('json','yaml') NOT NULL DEFAULT 'json',
  `emptyConfiguration` json DEFAULT NULL,
  `actions` json DEFAULT NULL,
  `fees` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `limits` text,
  `logger` enum('standard','gelf') NOT NULL DEFAULT 'standard',
  `loggerConfiguration` json DEFAULT NULL,
  `stagingStorageInput` enum('local','s3') NOT NULL DEFAULT 'local',
  `icon32` varchar(255) DEFAULT NULL,
  `icon64` varchar(255) DEFAULT NULL,
  `legacyUri` varchar(255) DEFAULT NULL,
  `permissions` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `vendor` (`vendor`),
  CONSTRAINT `apps_ibfk_1` FOREIGN KEY (`vendor`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS appVersions;
CREATE TABLE `appVersions` (
  `id` varchar(128) NOT NULL,
  `version` int(10) unsigned NOT NULL DEFAULT '1',
  `name` varchar(128) NOT NULL,
  `type` varchar(20) DEFAULT NULL,
  `repoType` varchar(20) DEFAULT NULL,
  `repoUri` varchar(128) DEFAULT NULL,
  `repoTag` varchar(20) DEFAULT NULL,
  `repoOptions` json DEFAULT NULL,
  `shortDescription` text,
  `longDescription` text,
  `licenseUrl` varchar(255) DEFAULT NULL,
  `documentationUrl` varchar(255) DEFAULT NULL,
  `requiredMemory` varchar(10) DEFAULT NULL,
  `processTimeout` int(10) unsigned DEFAULT NULL,
  `encryption` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `defaultBucket` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `defaultBucketStage` enum('in','out') DEFAULT NULL,
  `forwardToken` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `forwardTokenDetails` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `injectEnvironment` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `cpuShares` int(10) unsigned DEFAULT NULL,
  `uiOptions` json DEFAULT NULL,
  `imageParameters` json DEFAULT NULL,
  `testConfiguration` json DEFAULT NULL,
  `configurationSchema` json DEFAULT NULL,
  `configurationDescription` text,
  `configurationFormat` enum('json','yaml') NOT NULL DEFAULT 'json',
  `emptyConfiguration` json DEFAULT NULL,
  `actions` json DEFAULT NULL,
  `fees` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `limits` text,
  `logger` enum('standard','gelf') NOT NULL DEFAULT 'standard',
  `loggerConfiguration` json DEFAULT NULL,
  `stagingStorageInput` enum('local','s3') NOT NULL DEFAULT 'local',
  `icon32` varchar(255) DEFAULT NULL,
  `icon64` varchar(255) DEFAULT NULL,
  `legacyUri` varchar(255) DEFAULT NULL,
  `permissions` json DEFAULT NULL,
  `createdOn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` varchar(128) DEFAULT NULL,
  `isPublic` int(1) unsigned NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`,`version`),
  CONSTRAINT `appVersions_ibfk_1` FOREIGN KEY (`id`) REFERENCES `apps` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

SET foreign_key_checks = 1;

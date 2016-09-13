SET foreign_key_checks = 0;

DROP TABLE IF EXISTS vendors;
CREATE TABLE `vendors` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `address` varchar(255) NOT NULL,
  `email` varchar(128) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS apps;
CREATE TABLE `apps` (
  `id` varchar(50) NOT NULL,
  `vendor` varchar(50) NOT NULL,
  `isApproved` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `createdOn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` varchar(128) DEFAULT NULL,
  `version` int(10) unsigned NOT NULL DEFAULT '1',
  `name` varchar(128) NOT NULL,
  `type` enum('reader','application','writer') NOT NULL DEFAULT 'reader',
  `imageUrl` varchar(255) DEFAULT NULL,
  `imageTag` varchar(20) DEFAULT NULL,
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
  `uiOptions` json DEFAULT NULL,
  `testConfiguration` json DEFAULT NULL,
  `configurationSchema` json DEFAULT NULL,
  `networking` enum('dataIn','dataOut') DEFAULT NULL,
  `actions` json DEFAULT NULL,
  `fees` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `limits` text,
  `logger` enum('standard','gelf') NOT NULL DEFAULT 'standard',
  `icon32` varchar(255) DEFAULT NULL,
  `icon64` varchar(255) DEFAULT NULL,

  PRIMARY KEY (`id`),
  KEY `vendor` (`vendor`),
  CONSTRAINT `apps_ibfk_1` FOREIGN KEY (`vendor`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS appVersions;
CREATE TABLE `appVersions` (
  `id` varchar(50) NOT NULL,
  `version` int(10) unsigned NOT NULL DEFAULT '1',
  `name` varchar(128) NOT NULL,
  `type` enum('reader','application','writer') NOT NULL DEFAULT 'reader',
  `imageUrl` varchar(255) DEFAULT NULL,
  `imageTag` varchar(20) DEFAULT NULL,
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
  `uiOptions` json DEFAULT NULL,
  `testConfiguration` json DEFAULT NULL,
  `configurationSchema` json DEFAULT NULL,
  `networking` enum('dataIn','dataOut') DEFAULT NULL,
  `actions` json DEFAULT NULL,
  `fees` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `limits` text,
  `logger` enum('standard','gelf') NOT NULL DEFAULT 'standard',
  `icon32` varchar(255) DEFAULT NULL,
  `icon64` varchar(255) DEFAULT NULL,
  `createdOn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`id`,`version`),
  CONSTRAINT `appVersions_ibfk_1` FOREIGN KEY (`id`) REFERENCES `apps` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

SET foreign_key_checks = 1;
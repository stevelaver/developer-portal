ALTER TABLE `apps` DROP COLUMN `isApproved`;

ALTER TABLE `apps` ADD COLUMN `isDeprecated` tinyint(1) unsigned NOT NULL DEFAULT '0' AFTER `deletedOn`;
ALTER TABLE `appVersions` ADD COLUMN `isDeprecated` tinyint(1) unsigned NOT NULL DEFAULT '0' AFTER `deletedOn`;

ALTER TABLE `apps` ADD COLUMN `expiredOn` DATETIME NULL DEFAULT NULL AFTER `isDeprecated`;
ALTER TABLE `appVersions` ADD COLUMN `expiredOn` DATETIME NULL DEFAULT NULL AFTER `isDeprecated`;

ALTER TABLE `apps` ADD COLUMN `replacementApp` varchar(128) NULL DEFAULT NULL AFTER `expiredOn`;
ALTER TABLE `appVersions` ADD COLUMN `replacementApp` varchar(128) NULL DEFAULT NULL AFTER `expiredOn`;
ALTER TABLE `apps` ADD COLUMN `publishRequestOn` DATETIME NULL DEFAULT NULL AFTER `permissions`;

ALTER TABLE `apps` ADD COLUMN `publishRequestBy` VARCHAR(128) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL AFTER `publishRequestOn`;

ALTER TABLE `apps` ADD COLUMN `publishRequestRejectionReason` TEXT CHARACTER SET utf8 COLLATE utf8_general_ci NULL AFTER `publishRequestBy`;


ALTER TABLE `appVersions` ADD COLUMN `publishRequestOn` DATETIME NULL DEFAULT NULL AFTER `permissions`;

ALTER TABLE `appVersions` ADD COLUMN `publishRequestBy` VARCHAR(128) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL AFTER `publishRequestOn`;

ALTER TABLE `appVersions` ADD COLUMN `publishRequestRejectionReason` TEXT CHARACTER SET utf8 COLLATE utf8_general_ci NULL AFTER `publishRequestBy`;


ALTER TABLE `vendors` ADD COLUMN `isApproved` TINYINT(1) UNSIGNED NOT NULL DEFAULT '1' AFTER `isPublic`;
ALTER TABLE `vendors` ADD COLUMN `createdBy` varchar(128) DEFAULT NULL AFTER `createdOn`;
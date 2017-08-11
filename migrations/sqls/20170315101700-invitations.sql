DROP TABLE IF EXISTS invitations;
CREATE TABLE `invitations` (
  `code` varchar(64) NOT NULL DEFAULT '',
  `vendor` varchar(32) NOT NULL DEFAULT '',
  `email` varchar(128) NOT NULL DEFAULT '',
  `createdOn` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` varchar(128) NOT NULL DEFAULT '',
  `acceptedOn` datetime DEFAULT NULL,
  PRIMARY KEY (`code`),
  KEY `vendor` (`vendor`),
  KEY `idx_vendor_email` (`vendor`,`email`) USING BTREE,
  CONSTRAINT `vendor` FOREIGN KEY (`vendor`) REFERENCES `vendors` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
SET foreign_key_checks = 0;

DROP TABLE IF EXISTS users;
CREATE TABLE `users` (
  `id` varchar(128) NOT NULL DEFAULT '',
  `name` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `serviceAccount` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `createdOn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deletedOn` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS usersToVendors;
CREATE TABLE `usersToVendors` (
  `user` varchar(128) NOT NULL DEFAULT '',
  `vendor` varchar(32) NOT NULL DEFAULT '',
  `createdOn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user`,`vendor`),
  KEY `usersToVendors_ibfk_2` (`vendor`),
  CONSTRAINT `usersToVendors_ibfk_1` FOREIGN KEY (`user`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `usersToVendors_ibfk_2` FOREIGN KEY (`vendor`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS usersToVendorsRequests;
CREATE TABLE `usersToVendorsRequests` (
  `user` varchar(128) NOT NULL DEFAULT '',
  `vendor` varchar(32) NOT NULL DEFAULT '',
  `createdOn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user`,`vendor`),
  KEY `usersToVendorsRequests_ibfk_2` (`vendor`),
  CONSTRAINT `usersToVendorsRequests_ibfk_1` FOREIGN KEY (`user`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `usersToVendorsRequests_ibfk_2` FOREIGN KEY (`vendor`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

SET foreign_key_checks = 1;
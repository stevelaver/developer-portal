CREATE TABLE `users` (
  `id` varchar(128) NOT NULL DEFAULT '',
  `name` varchar(255) DEFAULT NULL,
  `createdOn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `serviceAccount` tinyint(1) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `usersToVendors` (
  `user` varchar(128) NOT NULL DEFAULT '',
  `vendor` varchar(32) NOT NULL DEFAULT '',
  `createdOn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user`,`vendor`),
  KEY `usersToVendors_ibfk_2` (`vendor`),
  CONSTRAINT `usersToVendors_ibfk_1` FOREIGN KEY (`user`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `usersToVendors_ibfk_2` FOREIGN KEY (`vendor`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `usersToVendorsRequests` (
  `user` varchar(128) NOT NULL DEFAULT '',
  `vendor` varchar(32) NOT NULL DEFAULT '',
  `createdOn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user`,`vendor`),
  KEY `usersToVendorsRequests_ibfk_2` (`vendor`),
  CONSTRAINT `usersToVendorsRequests_ibfk_1` FOREIGN KEY (`user`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `usersToVendorsRequests_ibfk_2` FOREIGN KEY (`vendor`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


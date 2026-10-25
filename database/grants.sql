CREATE USER IF NOT EXISTS 'ott_user'@'localhost'  IDENTIFIED BY 'u1s2e3r4@';
CREATE USER IF NOT EXISTS 'ott_admin'@'localhost' IDENTIFIED BY 'a1d2m3i4n5@';

-- normal account: read everything, write only where normal use needs it
GRANT SELECT ON OTT_Content_Management.* TO 'ott_user'@'localhost';
GRANT INSERT, UPDATE ON OTT_Content_Management.Users TO 'ott_user'@'localhost';
GRANT INSERT, UPDATE ON OTT_Content_Management.Subscriptions TO 'ott_user'@'localhost';
GRANT INSERT, UPDATE ON OTT_Content_Management.Watch_History TO 'ott_user'@'localhost';

-- admin account: full data access, but it cannot drop tables
GRANT SELECT, INSERT, UPDATE, DELETE ON OTT_Content_Management.* TO 'ott_admin'@'localhost';


SHOW GRANTS FOR 'ott_user'@'localhost';

SHOW GRANTS FOR 'ott_admin'@'localhost';


USE OTT_Content_Management;
DELIMITER //
 
-- Calculates End_Date from the plan duration
DROP TRIGGER IF EXISTS Set_Subscription_End_Date //
CREATE TRIGGER Set_Subscription_End_Date
BEFORE INSERT ON Subscriptions
FOR EACH ROW
BEGIN
    DECLARE plan_months INT;
    SELECT Duration_Months INTO plan_months
    FROM Subscription_Plans WHERE Plan_ID = NEW.Plan_ID;
 
    SET NEW.End_Date = DATE_SUB(DATE_ADD(NEW.Start_Date, INTERVAL plan_months MONTH), INTERVAL 1 DAY);
END //
 
-- Recalculates End_Date if the plan or start date is changed
DROP TRIGGER IF EXISTS Set_Subscription_End_Date_Update //
CREATE TRIGGER Set_Subscription_End_Date_Update
BEFORE UPDATE ON Subscriptions
FOR EACH ROW
BEGIN
    DECLARE plan_months INT;
    IF NEW.Plan_ID <> OLD.Plan_ID OR NEW.Start_Date <> OLD.Start_Date THEN
        SELECT Duration_Months INTO plan_months
        FROM Subscription_Plans WHERE Plan_ID = NEW.Plan_ID;
 
        SET NEW.End_Date = DATE_SUB(DATE_ADD(NEW.Start_Date, INTERVAL plan_months MONTH), INTERVAL 1 DAY);
    END IF;
END //
 
-- One valid subscription per user at a time
DROP TRIGGER IF EXISTS Prevent_Duplicate_Active_Subscription //
CREATE TRIGGER Prevent_Duplicate_Active_Subscription
BEFORE INSERT ON Subscriptions
FOR EACH ROW
BEGIN
    IF NEW.Status = 'Active' AND EXISTS (
        SELECT 1 FROM Subscriptions
        WHERE User_ID = NEW.User_ID
          AND Status = 'Active'
          AND CURDATE() BETWEEN Start_Date AND End_Date
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'User already has an active subscription';
    END IF;
END //
 
-- Same rule when a subscription is updated (ignores the row being updated)
DROP TRIGGER IF EXISTS Prevent_Duplicate_Active_Subscription_Update //
CREATE TRIGGER Prevent_Duplicate_Active_Subscription_Update
BEFORE UPDATE ON Subscriptions
FOR EACH ROW
BEGIN
    IF NEW.Status = 'Active' AND EXISTS (
        SELECT 1 FROM Subscriptions
        WHERE User_ID = NEW.User_ID
          AND Subscription_ID <> OLD.Subscription_ID
          AND Status = 'Active'
          AND CURDATE() BETWEEN Start_Date AND End_Date
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'User already has an active subscription';
    END IF;
END //
 
-- Completed is TRUE only when Progress = 100
DROP TRIGGER IF EXISTS Auto_Mark_Completed_Insert //
CREATE TRIGGER Auto_Mark_Completed_Insert
BEFORE INSERT ON Watch_History
FOR EACH ROW
BEGIN
    SET NEW.Completed = (NEW.Progress = 100);
END //
 
DROP TRIGGER IF EXISTS Auto_Mark_Completed_Update //
CREATE TRIGGER Auto_Mark_Completed_Update
BEFORE UPDATE ON Watch_History
FOR EACH ROW
BEGIN
    SET NEW.Completed = (NEW.Progress = 100);
END //
 
-- Only one Admin account
DROP TRIGGER IF EXISTS Single_Admin_Insert //
CREATE TRIGGER Single_Admin_Insert
BEFORE INSERT ON Users
FOR EACH ROW
BEGIN
    IF NEW.Role = 'Admin' AND EXISTS (SELECT 1 FROM Users WHERE Role = 'Admin') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only one admin account is allowed';
    END IF;
END //
 
DROP TRIGGER IF EXISTS Single_Admin_Update //
CREATE TRIGGER Single_Admin_Update
BEFORE UPDATE ON Users
FOR EACH ROW
BEGIN
    IF NEW.Role = 'Admin' AND OLD.Role <> 'Admin'
       AND EXISTS (SELECT 1 FROM Users WHERE Role = 'Admin') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only one admin account is allowed';
    END IF;
END //
 
DELIMITER ;
 
-- TEST QUERIES
-- PART A: read-only checks
 
-- A1 foreign keys: expect 0 rows
SELECT * FROM Subscriptions s LEFT JOIN Users u ON u.User_ID = s.User_ID WHERE u.User_ID IS NULL;
SELECT * FROM Watch_History w LEFT JOIN Content c ON c.Content_ID = w.Content_ID WHERE c.Content_ID IS NULL;
 
-- A2 expect Is_Valid = 1 for users 1-4, 0 for user 5
SELECT u.Name, s.Status, s.Start_Date, s.End_Date,
       (s.Status = 'Active' AND CURDATE() BETWEEN s.Start_Date AND s.End_Date) AS Is_Valid
FROM Subscriptions s JOIN Users u ON u.User_ID = s.User_ID
ORDER BY u.User_ID, s.Start_Date;
 
-- A3 expect Matches = 1
SELECT s.Subscription_ID,
       s.End_Date = DATE_SUB(DATE_ADD(s.Start_Date, INTERVAL p.Duration_Months MONTH), INTERVAL 1 DAY) AS Matches
FROM Subscriptions s JOIN Subscription_Plans p ON p.Plan_ID = s.Plan_ID;
 
-- A4 access check the backend runs before watching (row = allowed)
SELECT s.Subscription_ID
FROM Subscriptions s
JOIN Subscription_Plans p ON p.Plan_ID = s.Plan_ID
JOIN Content c            ON c.Content_ID = 204
WHERE s.User_ID = 1
  AND s.Status = 'Active'
  AND CURDATE() BETWEEN s.Start_Date AND s.End_Date
  AND (p.Access_Type = 'All' OR c.Type IN ('Movies', 'Series'));
 
-- A5 category access: user 1 only Movies/Series, users 2-4 all, user 5 none
SELECT u.Name, c.Title, c.Type,
       IF(EXISTS (SELECT 1 FROM Subscriptions s JOIN Subscription_Plans p ON p.Plan_ID = s.Plan_ID
                  WHERE s.User_ID = u.User_ID AND s.Status = 'Active'
                    AND CURDATE() BETWEEN s.Start_Date AND s.End_Date
                    AND (p.Access_Type = 'All' OR c.Type IN ('Movies', 'Series'))), 'Yes', 'No') AS Allowed
FROM Users u CROSS JOIN Content c
WHERE u.Role = 'User'
ORDER BY u.User_ID, c.Content_ID;
 
-- A6 Completed = 1 only at Progress 100
SELECT History_ID, Progress, Completed FROM Watch_History ORDER BY History_ID;
 
-- A7 expect 1 row
SELECT User_ID, Email, Role FROM Users WHERE Role = 'Admin';
 
-- Tests that change data (undone with ROLLBACK)
START TRANSACTION;
 
-- B1 Completed follows Progress: expect 0, then 1, then 1 (insert with Completed = FALSE is corrected)
UPDATE Watch_History SET Progress = 80 WHERE History_ID = 5001;
SELECT Progress, Completed FROM Watch_History WHERE History_ID = 5001;
UPDATE Watch_History SET Progress = 100 WHERE History_ID = 5002;
SELECT Progress, Completed FROM Watch_History WHERE History_ID = 5002;
INSERT INTO Watch_History (User_ID, Content_ID, Progress, Completed) VALUES (1, 203, 100, FALSE);
SELECT Progress, Completed FROM Watch_History ORDER BY History_ID DESC LIMIT 1;
 
-- B2 End_Date is set on insert: expect Start_Date + 1 month - 1 day
INSERT INTO Subscriptions (User_ID, Plan_ID, Start_Date, End_Date, Status)
VALUES (5, 101, CURDATE(), CURDATE(), 'Active');
SELECT * FROM Subscriptions WHERE User_ID = 5 ORDER BY Subscription_ID DESC LIMIT 1;
 
-- B3 End_Date is recalculated when the plan changes: expect Start_Date + 12 months - 1 day
UPDATE Subscriptions SET Plan_ID = 103 WHERE Subscription_ID = 1001;
SELECT Subscription_ID, Start_Date, End_Date FROM Subscriptions WHERE Subscription_ID = 1001;
 
-- B4 A Cancelled subscription is not valid even inside its dates: expect Is_Valid = 0
UPDATE Subscriptions SET Status = 'Cancelled' WHERE Subscription_ID = 1002;
SELECT Subscription_ID, Status,
       (Status = 'Active' AND CURDATE() BETWEEN Start_Date AND End_Date) AS Is_Valid
FROM Subscriptions WHERE Subscription_ID = 1002;
 
-- B5 The admin row itself can still be updated: expect no error
UPDATE Users SET Name = Name WHERE Role = 'Admin';
 
ROLLBACK;
 
-- Tests that must fail (run them one at a time)
-- F1 expect error: user 2 already has a valid subscription (insert)
INSERT INTO Subscriptions (User_ID, Plan_ID, Start_Date, End_Date, Status)
VALUES (2, 103, CURDATE(), CURDATE(), 'Active');
 
-- F2 expect error: same rule on update (user 4 already has valid subscription 1005)
UPDATE Subscriptions SET Status = 'Active' WHERE Subscription_ID = 1004;
 
-- F3 expect error: second admin (insert)
INSERT INTO Users (Name, Email, Password, Phone, Role)
VALUES ('Second Admin', 'admin2@streamverse.com', 'x', '9000000000', 'Admin');
 
-- F4 expect error: second admin (promote an existing user)
UPDATE Users
SET Name = Name
WHERE User_ID = 6 AND Role = 'Admin';
 
-- Optional: tidy old Status values (the app must not depend on this)
-- UPDATE Subscriptions SET Status = 'Expired' WHERE Status = 'Active' AND End_Date < CURDATE();
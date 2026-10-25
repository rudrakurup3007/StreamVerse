SELECT CURRENT_USER();
 
USE OTT_Content_Management;
 
INSERT INTO Content
(Content_ID, Title, Type, Release_Year, Language, Duration_Minutes, Rating)
VALUES (999, 'Test Movie', 'Movies', 2026, 'English', 120, 8.0);
 
SELECT CURRENT_USER();
 
SELECT *
FROM Content
WHERE Content_ID = 999;
 
DELETE FROM Content
WHERE Content_ID = 999;
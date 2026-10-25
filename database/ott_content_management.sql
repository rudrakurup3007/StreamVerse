-- Dev only: uncomment to delete everything and start again.
-- DROP DATABASE IF EXISTS OTT_Content_Management;
 
CREATE DATABASE IF NOT EXISTS OTT_Content_Management;
USE OTT_Content_Management;
 
-- 1. Users
CREATE TABLE Users (
    User_ID  INT AUTO_INCREMENT PRIMARY KEY,
    Name     VARCHAR(100) NOT NULL,
    Email    VARCHAR(100) NOT NULL UNIQUE,
    Password VARCHAR(255) NOT NULL,
    Phone    VARCHAR(15) UNIQUE,
    Role     VARCHAR(10) NOT NULL DEFAULT 'User',
    CHECK (Role IN ('User', 'Admin'))
);
 
-- 2. Subscription_Plans
CREATE TABLE Subscription_Plans (
    Plan_ID         INT AUTO_INCREMENT PRIMARY KEY,
    Plan_Name       VARCHAR(50) NOT NULL,
    Price           DECIMAL(10,2) NOT NULL CHECK (Price >= 0),
    Duration_Months INT NOT NULL CHECK (Duration_Months > 0),
    Video_Quality   VARCHAR(20) NOT NULL,
    Access_Type     VARCHAR(10) NOT NULL DEFAULT 'All',
    CHECK (Access_Type IN ('Limited', 'All'))
);
 
-- 3. Content
CREATE TABLE Content (
    Content_ID       INT AUTO_INCREMENT PRIMARY KEY,
    Title            VARCHAR(150) NOT NULL,
    Type             VARCHAR(10) NOT NULL,
    Release_Year     YEAR NOT NULL,
    Language         VARCHAR(50) NOT NULL,
    Duration_Minutes INT NOT NULL CHECK (Duration_Minutes > 0),
    Rating           DECIMAL(3,1) CHECK (Rating BETWEEN 0 AND 10),
    CHECK (Type IN ('Movies', 'Series', 'News', 'Sports', 'Kids'))
);
 
-- 4. Subscriptions
-- End_Date = last valid day = Start_Date + plan months - 1 day.
-- Valid only if Status = 'Active' AND CURDATE() BETWEEN Start_Date AND End_Date.
CREATE TABLE Subscriptions (
    Subscription_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID    INT NOT NULL,
    Plan_ID    INT NOT NULL,
    Start_Date DATE NOT NULL,
    End_Date   DATE NOT NULL,
    Status     VARCHAR(20) NOT NULL DEFAULT 'Active',
    FOREIGN KEY (User_ID) REFERENCES Users(User_ID),
    FOREIGN KEY (Plan_ID) REFERENCES Subscription_Plans(Plan_ID),
    CHECK (End_Date >= Start_Date),
    CHECK (Status IN ('Active', 'Expired', 'Cancelled'))
);
 
-- 5. Watch_History
CREATE TABLE Watch_History (
    History_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID    INT NOT NULL,
    Content_ID INT NOT NULL,
    Watched_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Progress   INT NOT NULL DEFAULT 0 CHECK (Progress BETWEEN 0 AND 100),
    Completed  BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (User_ID) REFERENCES Users(User_ID),
    FOREIGN KEY (Content_ID) REFERENCES Content(Content_ID)
);
 
-- Plans
INSERT INTO Subscription_Plans (Plan_ID, Plan_Name, Price, Duration_Months, Video_Quality, Access_Type) VALUES
(101, 'Movies & Series',   100.00,  1, 'HD',      'Limited'),
(102, 'All Access Monthly', 250.00,  1, 'Full HD', 'All'),
(103, 'All Access Annual', 2000.00, 12, '4K',      'All');
 
-- Users
-- Demo password for users 1-5 is Demo@1234 (only the bcrypt hash is stored).
INSERT INTO Users (User_ID, Name, Email, Password, Phone, Role) VALUES
(1, 'Rahul Sharma',   'rahul@gmail.com', '$2b$10$jq6OzAkmVDJbsNd4exepf.krFE0EsPeL3xbqTI4JgVfzuvbBN47hO', '9876543210', 'User'),
(2, 'Priya Patil',    'priya@gmail.com', '$2b$10$jq6OzAkmVDJbsNd4exepf.krFE0EsPeL3xbqTI4JgVfzuvbBN47hO', '9876543211', 'User'),
(3, 'Aman Joshi',     'aman@gmail.com',  '$2b$10$jq6OzAkmVDJbsNd4exepf.krFE0EsPeL3xbqTI4JgVfzuvbBN47hO', '9876543212', 'User'),
(4, 'Sneha Kulkarni', 'sneha@gmail.com', '$2b$10$jq6OzAkmVDJbsNd4exepf.krFE0EsPeL3xbqTI4JgVfzuvbBN47hO', '9876543213', 'User'),
(5, 'Rohan Mehta',    'rohan@gmail.com', '$2b$10$jq6OzAkmVDJbsNd4exepf.krFE0EsPeL3xbqTI4JgVfzuvbBN47hO', '9876543214', 'User');
 
-- Demo admin login: admin@streamverse.com / Admin@1234 (only the hash is stored). Change it before real use.
INSERT INTO Users (User_ID, Name, Email, Password, Phone, Role) VALUES
(6, 'StreamVerse Admin', 'admin@streamverse.com', '$2b$10$d4UFbPCEuiEAboRpC4bjBO/SoNfQX0e2CU/IE5ymg8fkuIcRJdXgO', NULL, 'Admin');
 
-- Content (5 categories)
INSERT INTO Content (Content_ID, Title, Type, Release_Year, Language, Duration_Minutes, Rating) VALUES
(201, 'The Silent Code',        'Movies', 2024, 'English', 125, 8.2),
(202, 'Mumbai Diaries',         'Series', 2023, 'Hindi',    45, 8.7),
(203, 'Tech Warriors',          'Series', 2025, 'English',  50, 8.5),
(204, 'The Last Journey',       'Movies', 2022, 'Hindi',   135, 7.9),
(205, 'Nature Uncovered',       'Kids',   2025, 'English',  60, 9.0),
(206, 'Evening Bulletin',       'News',   2026, 'English',  30, 7.5),
(207, 'Pitch Perfect Cricket',  'Sports', 2025, 'English', 190, 9.2),
(208, 'Pico & the Moon Train',  'Kids',   2024, 'English',  24, 8.8);
 
-- Subscriptions
-- User 4 renewed after an expired plan. User 5 is 'Active' but past its End_Date (on purpose, for testing).
INSERT INTO Subscriptions (Subscription_ID, User_ID, Plan_ID, Start_Date, End_Date, Status) VALUES
(1001, 1, 101, DATE_SUB(CURDATE(), INTERVAL 5 DAY),
    DATE_SUB(DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 5 DAY), INTERVAL 1 MONTH), INTERVAL 1 DAY), 'Active'),
(1002, 2, 102, DATE_SUB(CURDATE(), INTERVAL 10 DAY),
    DATE_SUB(DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 10 DAY), INTERVAL 1 MONTH), INTERVAL 1 DAY), 'Active'),
(1003, 3, 103, DATE_SUB(CURDATE(), INTERVAL 60 DAY),
    DATE_SUB(DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 60 DAY), INTERVAL 12 MONTH), INTERVAL 1 DAY), 'Active'),
(1004, 4, 101, DATE_SUB(CURDATE(), INTERVAL 120 DAY),
    DATE_SUB(DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 120 DAY), INTERVAL 1 MONTH), INTERVAL 1 DAY), 'Expired'),
(1005, 4, 102, DATE_SUB(CURDATE(), INTERVAL 3 DAY),
    DATE_SUB(DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 3 DAY), INTERVAL 1 MONTH), INTERVAL 1 DAY), 'Active'),
(1006, 5, 102, DATE_SUB(CURDATE(), INTERVAL 60 DAY),
    DATE_SUB(DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 60 DAY), INTERVAL 1 MONTH), INTERVAL 1 DAY), 'Active');
 
-- Watch history
INSERT INTO Watch_History (History_ID, User_ID, Content_ID, Watched_At, Progress, Completed) VALUES
(5001, 1, 201, DATE_SUB(NOW(), INTERVAL 4 DAY),  100, TRUE),
(5002, 1, 202, DATE_SUB(NOW(), INTERVAL 3 DAY),   60, FALSE),
(5003, 2, 203, DATE_SUB(NOW(), INTERVAL 5 DAY),  100, TRUE),
(5004, 3, 204, DATE_SUB(NOW(), INTERVAL 2 DAY),   75, FALSE),
(5005, 3, 207, DATE_SUB(NOW(), INTERVAL 1 DAY),  100, TRUE),
(5006, 4, 208, DATE_SUB(NOW(), INTERVAL 1 HOUR),  30, FALSE);
-- =====================================================
-- Création de la base de données
-- =====================================================
CREATE DATABASE IF NOT EXISTS DZTelecom;

USE DZTelecom;

-- =====================================================
-- Table CUSTOMER
-- =====================================================
CREATE TABLE CUSTOMER (
    customerId INT AUTO_INCREMENT PRIMARY KEY,
    customerName VARCHAR(150) NOT NULL,
    address TEXT,
    email VARCHAR(150) UNIQUE
);

-- =====================================================
-- Table SUBSCRIBER
-- =====================================================
CREATE TABLE SUBSCRIBER (
    phoneNumber VARCHAR(20) PRIMARY KEY,
    customerId INT NOT NULL,
    balance DECIMAL(10,2) DEFAULT 0,
    operatorName VARCHAR(100),
    lineType VARCHAR(50),
    lineStatus VARCHAR(50),
    activationDate DATE,
    simCode VARCHAR(100),

    CONSTRAINT fk_subscriber_customer
        FOREIGN KEY (customerId)
        REFERENCES CUSTOMER(customerId)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- =====================================================
-- Table RECHARGE
-- =====================================================
CREATE TABLE RECHARGE (
    rechargeId INT AUTO_INCREMENT PRIMARY KEY,
    phoneNumber VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    rechargeDate DATE NOT NULL,
    paymentMethod VARCHAR(50),

    CONSTRAINT fk_recharge_subscriber
        FOREIGN KEY (phoneNumber)
        REFERENCES SUBSCRIBER(phoneNumber)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- =====================================================
-- Table SERVICE
-- =====================================================
CREATE TABLE SERVICE (
    serviceId INT AUTO_INCREMENT PRIMARY KEY,
    serviceName VARCHAR(150) NOT NULL
);

-- =====================================================
-- Table USES
-- =====================================================
CREATE TABLE USES (
    phoneNumber VARCHAR(20) NOT NULL,
    serviceId INT NOT NULL,
    usageDateTime DATETIME NOT NULL,
    callDuration INT DEFAULT 0,
    dataBytes FLOAT DEFAULT 0,
    amount DECIMAL(10,2) DEFAULT 0,

    PRIMARY KEY (phoneNumber, serviceId, usageDateTime),

    CONSTRAINT fk_uses_subscriber
        FOREIGN KEY (phoneNumber)
        REFERENCES SUBSCRIBER(phoneNumber)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_uses_service
        FOREIGN KEY (serviceId)
        REFERENCES SERVICE(serviceId)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- =====================================================
-- Table PLAN
-- =====================================================
CREATE TABLE PLAN (
    planId INT AUTO_INCREMENT PRIMARY KEY,
    planName VARCHAR(150) NOT NULL,
    monthlyRate DECIMAL(10,2) NOT NULL CHECK (monthlyRate >= 0)
);

-- =====================================================
-- Table FEATURE
-- =====================================================
CREATE TABLE FEATURE (
    featureId INT AUTO_INCREMENT PRIMARY KEY,
    planId INT NOT NULL,
    featureName VARCHAR(150) NOT NULL,

    CONSTRAINT fk_feature_plan
        FOREIGN KEY (planId)
        REFERENCES PLAN(planId)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- =====================================================
-- Table SIGNUP
-- =====================================================
CREATE TABLE SIGNUP (
    phoneNumber VARCHAR(20) NOT NULL,
    planId INT NOT NULL,
    startDate DATE NOT NULL,
    endDate DATE NOT NULL,
    amount DECIMAL(10,2) DEFAULT 0,

    PRIMARY KEY (phoneNumber, planId, startDate),

    CONSTRAINT chk_dates
        CHECK (startDate < endDate),

    CONSTRAINT fk_signup_subscriber
        FOREIGN KEY (phoneNumber)
        REFERENCES SUBSCRIBER(phoneNumber)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_signup_plan
        FOREIGN KEY (planId)
        REFERENCES PLAN(planId)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);



-- =====================================================
-- INSERTION DES CLIENTS
-- =====================================================
INSERT INTO CUSTOMER (customerName, address, email) VALUES
('Ahmed Benali', 'Alger Centre, Alger', 'ahmed.benali@gmail.com'),
('Sonia Khelifi', 'Oran Centre, Oran', 'sonia.khelifi@gmail.com'),
('Karim Meziane', 'Constantine', 'karim.meziane@gmail.com'),
('Nadia Boussouf', 'Tizi Ouzou', 'nadia.boussouf@gmail.com'),
('Yacine Rahmani', 'Annaba', 'yacine.rahmani@gmail.com'),
('Leila Hamidi', 'Bejaia', 'leila.hamidi@gmail.com'),
('Farid Mansouri', 'Sétif', 'farid.mansouri@gmail.com'),
('Amina Lounis', 'Blida', 'amina.lounis@gmail.com'),
('Samir Boudiaf', 'Batna', 'samir.boudiaf@gmail.com'),
('Imane Haddad', 'Mostaganem', 'imane.haddad@gmail.com'),
('Mourad Zerrouki', 'Ghardaia', 'mourad.zerrouki@gmail.com');

-- =====================================================
-- INSERTION DES ABONNÉS
-- =====================================================
INSERT INTO SUBSCRIBER
(phoneNumber, customerId, balance, operatorName, lineType, lineStatus, activationDate, simCode)
VALUES
('0550123456', 1, 1200.50, 'Mobilis', 'Prépayé', 'Active', '2023-01-15', 'SIMDZ1001'),
('0661456789', 2, 540.00, 'Djezzy', 'Postpayé', 'Active', '2022-11-20', 'SIMDZ1002'),
('0770987654', 3, 300.75, 'Ooredoo', 'Prépayé', 'Suspendue', '2021-06-10', 'SIMDZ1003'),
('0550789456', 4, 950.20, 'Mobilis', 'Postpayé', 'Active', '2024-02-01', 'SIMDZ1004'),
('0661998877', 5, 150.00, 'Djezzy', 'Prépayé', 'Inactive', '2020-09-05', 'SIMDZ1005'),
('0771234567', 7, 820.00, 'Ooredoo', 'Postpayé', 'Active', '2023-08-18', 'SIMDZ1006'),
('0552233445', 8, 410.25, 'Mobilis', 'Prépayé', 'Inactive', '2022-04-22', 'SIMDZ1007'),
('0773344556', 9, 1320.00, 'Djezzy', 'Postpayé', 'Active', '2024-01-09', 'SIMDZ1008'),
('0667788990', 10, 275.50, 'Ooredoo', 'Prépayé', 'Suspendue', '2021-12-12', 'SIMDZ1009');

-- =====================================================
-- INSERTION DES RECHARGES
-- =====================================================
INSERT INTO RECHARGE
(phoneNumber, amount, rechargeDate, paymentMethod)
VALUES
('0550123456', 1000, '2024-01-10', 'Carte Edahabia'),
('0550123456', 500, '2024-03-15', 'CIB'),
('0661456789', 2000, '2024-02-20', 'Espèces'),
('0770987654', 300, '2024-01-05', 'BaridiMob'),
('0550789456', 1500, '2024-04-12', 'Carte Bancaire'),
('0550123456', 700, '2025-01-12', 'BaridiMob'),
('0771234567', 650, '2025-02-04', 'CIB'),
('0661456789', 1200, '2025-03-08', 'CIB'),
('0550789456', 900, '2025-03-27', 'Carte Edahabia'),
('0773344556', 1800, '2025-04-10', 'Carte Bancaire'),
('0550123456', 300, '2025-05-03', 'Espèces'),
('0667788990', 250, '2025-06-16', 'BaridiMob'),
('0661998877', 400, '2025-07-19', 'Espèces'),
('0552233445', 550, '2025-09-02', 'Carte Edahabia'),
('0771234567', 1000, '2025-11-21', 'CIB'),
('0773344556', 2200, '2025-12-05', 'Carte Bancaire');

-- =====================================================
-- INSERTION DES SERVICES
-- =====================================================
INSERT INTO SERVICE (serviceName) VALUES
('Appel National'),
('SMS'),
('Internet 4G'),
('Appel International'),
('Roaming');

-- =====================================================
-- INSERTION DES USES
-- =====================================================
INSERT INTO USES
(phoneNumber, serviceId, usageDateTime, callDuration, dataBytes, amount)
VALUES
('0550123456', 1, '2024-05-01 10:15:00', 15, 24576.00, 30),
('0550123456', 3, '2024-05-01 12:00:00', 45, 1500000000.75, 100),
('0550123456', 2, '2024-05-01 13:20:00', 1, 2048.00, 15),
('0550123456', 4, '2024-05-01 18:45:00', 12, 32768.00, 320),
('0661456789', 2, '2024-05-02 09:45:00', 1, 1536.00, 10),
('0661456789', 1, '2024-05-02 11:15:00', 22, 28672.00, 44),
('0661456789', 3, '2024-05-02 13:00:00', 60, 4200000000.00, 180),
('0770987654', 4, '2024-05-03 20:10:00', 8, 18432.00, 250),
('0550789456', 3, '2024-05-04 14:30:00', 50, 3500000000.20, 200),
('0550789456', 1, '2024-05-04 17:10:00', 18, 22528.00, 36),
('0771234567', 1, '2024-05-05 08:05:00', 35, 49152.00, 70),
('0771234567', 2, '2024-05-05 08:45:00', 2, 3072.00, 20),
('0771234567', 3, '2024-05-05 10:30:00', 95, 9000000000.00, 300),
('0771234567', 4, '2024-05-05 21:15:00', 5, 12288.00, 180),
('0661998877', 2, '2024-05-06 09:00:00', 1, 1024.00, 5),
('0661998877', 3, '2024-05-06 10:20:00', 20, 750000000.00, 50),
('0552233445', 2, '2024-05-07 12:30:00', 1, 1792.00, 12),
('0552233445', 3, '2024-05-07 13:05:00', 35, 2200000000.00, 90),
('0773344556', 1, '2024-05-08 15:45:00', 45, 57344.00, 90),
('0773344556', 3, '2024-05-08 16:10:00', 120, 12000000000.00, 450),
('0773344556', 4, '2024-05-08 22:05:00', 14, 40960.00, 400),
('0667788990', 2, '2024-05-09 09:25:00', 1, 1280.00, 7),
('0667788990', 4, '2024-05-09 19:40:00', 3, 8192.00, 100),
('0550123456', 5, '2024-05-10 09:10:00', 6, 5242880.00, 650),
('0771234567', 5, '2024-05-10 18:25:00', 9, 8388608.00, 900);

-- =====================================================
-- INSERTION DES PLANS
-- =====================================================
INSERT INTO PLAN (planName, monthlyRate) VALUES
('Forfait Mobilis Haya', 1500),
('Forfait Djezzy Smart', 2000),
('Forfait Ooredoo Maxy', 1800),
('Forfait DZ Premium', 3500);

-- =====================================================
-- INSERTION DES FEATURES
-- =====================================================
INSERT INTO FEATURE (planId, featureName) VALUES
(1, 'Appels illimités Mobilis'),
(1, '20 Go Internet'),
(2, 'SMS illimités'),
(2, '40 Go Internet'),
(3, 'Facebook gratuit'),
(3, '30 Go Internet'),
(4, 'Appels internationaux inclus'),
(4, '100 Go Internet'),
(4, 'Support premium'),
(4, 'SMS illimités vers tous les réseaux');

-- =====================================================
-- INSERTION DES SIGNUPS
-- =====================================================
INSERT INTO SIGNUP
(phoneNumber, planId, startDate, endDate, amount)
VALUES
('0550123456', 1, '2024-01-01', '2024-12-31', 1500),
('0550123456', 2, '2024-06-01', '2024-12-31', 2000),
('0661456789', 2, '2024-02-01', '2025-01-31', 2000),
('0770987654', 3, '2024-03-01', '2025-02-28', 1800),
('0550789456', 1, '2024-04-01', '2025-03-31', 1500),
('0771234567', 3, '2024-05-01', '2025-04-30', 1800),
('0771234567', 4, '2024-09-01', '2025-08-31', 3500),
('0552233445', 1, '2023-10-01', '2024-09-30', 1500),
('0773344556', 2, '2024-01-15', '2025-01-14', 2000),
('0773344556', 4, '2025-01-15', '2025-12-31', 3500),
('0667788990', 3, '2023-06-01', '2024-05-31', 1800);




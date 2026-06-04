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
-- Table USAGE
-- =====================================================
CREATE TABLE `USAGE` (
    phoneNumber VARCHAR(20) NOT NULL,
    serviceId INT NOT NULL,
    usageDateTime DATETIME NOT NULL,
    callDuration INT DEFAULT 0,
    dataBytes FLOAT DEFAULT 0,
    amount DECIMAL(10,2) DEFAULT 0,

    PRIMARY KEY (phoneNumber, serviceId, usageDateTime),

    CONSTRAINT fk_usage_subscriber
        FOREIGN KEY (phoneNumber)
        REFERENCES SUBSCRIBER(phoneNumber)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_usage_service
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
-- Table SUBSCRIPTION
-- =====================================================
CREATE TABLE SUBSCRIPTION (
    phoneNumber VARCHAR(20) NOT NULL,
    planId INT NOT NULL,
    startDate DATE NOT NULL,
    endDate DATE NOT NULL,
    amount DECIMAL(10,2) DEFAULT 0,

    PRIMARY KEY (phoneNumber, planId, startDate),

    CONSTRAINT chk_dates
        CHECK (startDate < endDate),

    CONSTRAINT fk_subscription_subscriber
        FOREIGN KEY (phoneNumber)
        REFERENCES SUBSCRIBER(phoneNumber)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_subscription_plan
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
('Yacine Rahmani', 'Annaba', 'yacine.rahmani@gmail.com');

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
('0661998877', 5, 150.00, 'Djezzy', 'Prépayé', 'Inactive', '2020-09-05', 'SIMDZ1005');

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
('0550789456', 1500, '2024-04-12', 'Carte Bancaire');

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
-- INSERTION DES USAGES
-- =====================================================
INSERT INTO `USAGE`
(phoneNumber, serviceId, usageDateTime, callDuration, dataBytes, amount)
VALUES
('0550123456', 1, '2024-05-01 10:15:00', 15, 0, 30),
('0550123456', 3, '2024-05-01 12:00:00', 0, 1500.75, 100),
('0661456789', 2, '2024-05-02 09:45:00', 0, 0, 10),
('0770987654', 4, '2024-05-03 20:10:00', 8, 0, 250),
('0550789456', 3, '2024-05-04 14:30:00', 0, 3500.20, 200);

-- =====================================================
-- INSERTION DES PLANS
-- =====================================================
INSERT INTO PLAN (planName, monthlyRate) VALUES
('Forfait Mobilis Haya', 1500),
('Forfait Djezzy Smart', 2000),
('Forfait Ooredoo Maxy', 1800);

-- =====================================================
-- INSERTION DES FEATURES
-- =====================================================
INSERT INTO FEATURE (planId, featureName) VALUES
(1, 'Appels illimités Mobilis'),
(1, '20 Go Internet'),
(2, 'SMS illimités'),
(2, '40 Go Internet'),
(3, 'Facebook gratuit'),
(3, '30 Go Internet');

-- =====================================================
-- INSERTION DES ABONNEMENTS
-- =====================================================
INSERT INTO SUBSCRIPTION
(phoneNumber, planId, startDate, endDate, amount)
VALUES
('0550123456', 1, '2024-01-01', '2024-12-31', 1500),
('0661456789', 2, '2024-02-01', '2025-01-31', 2000),
('0770987654', 3, '2024-03-01', '2025-02-28', 1800),
('0550789456', 1, '2024-04-01', '2025-03-31', 1500);




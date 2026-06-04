export type ExerciseType = "ddl" | "dql" | "dml";

export type ExpectedOutput = {
  columns: string[];
  rows: Record<string, unknown>[];
};

export type VerificationQuery = {
  sql: string;
  expectedOutput?: ExpectedOutput;
};

export type Exercise = {
  id: string;
  part: string;
  order: number;
  title: string;
  description: string;
  type: ExerciseType;
  hints: string[];
  solutionQueries: string[];
  verificationQueries?: VerificationQuery[];
  allowAlter?: boolean;
  initialCode?: string;
};

export type ExerciseSummary = Pick<
  Exercise,
  "id" | "part" | "order" | "title" | "type" | "allowAlter"
>;

export type ExerciseGroup = {
  part: string;
  exercises: ExerciseSummary[];
};

const baseCreateDatabasePrefix =
  "CREATE DATABASE IF NOT EXISTS DZTelecom;\nUSE DZTelecom;";

const customerTableSql = `CREATE TABLE CUSTOMER (
    customerId INT AUTO_INCREMENT PRIMARY KEY,
    customerName VARCHAR(150) NOT NULL,
    address TEXT,
    email VARCHAR(150) UNIQUE
);`;

const subscriberTableSql = `CREATE TABLE SUBSCRIBER (
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
);`;

const rechargeTableSql = `CREATE TABLE RECHARGE (
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
);`;

const serviceTableSql = `CREATE TABLE SERVICE (
    serviceId INT AUTO_INCREMENT PRIMARY KEY,
    serviceName VARCHAR(150) NOT NULL
);`;

const usageTableSql = `CREATE TABLE \`USAGE\` (
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
);`;

const planTableSql = `CREATE TABLE PLAN (
    planId INT AUTO_INCREMENT PRIMARY KEY,
    planName VARCHAR(150) NOT NULL,
    monthlyRate DECIMAL(10,2) NOT NULL CHECK (monthlyRate >= 0)
);`;

const featureTableSql = `CREATE TABLE FEATURE (
    featureId INT AUTO_INCREMENT PRIMARY KEY,
    planId INT NOT NULL,
    featureName VARCHAR(150) NOT NULL,
    CONSTRAINT fk_feature_plan
        FOREIGN KEY (planId)
        REFERENCES PLAN(planId)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);`;

const subscriptionTableSql = `CREATE TABLE SUBSCRIPTION (
    phoneNumber VARCHAR(20) NOT NULL,
    planId INT NOT NULL,
    startDate DATE NOT NULL,
    endDate DATE NOT NULL,
    amount DECIMAL(10,2) DEFAULT 0,
    PRIMARY KEY (phoneNumber, planId, startDate),
    CONSTRAINT chk_dates CHECK (startDate < endDate),
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
);`;

const fullCreationScript = [
  baseCreateDatabasePrefix,
  customerTableSql,
  subscriberTableSql,
  rechargeTableSql,
  serviceTableSql,
  usageTableSql,
  planTableSql,
  featureTableSql,
  subscriptionTableSql,
].join("\n\n");

const tableExistsVerification = (tableName: string): VerificationQuery => ({
  sql: `SELECT TABLE_NAME AS tableName
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}'`,
  expectedOutput: {
    columns: ["tableName"],
    rows: [{ tableName }],
  },
});

const columnCountVerification = (
  tableName: string,
  columnCount: number,
): VerificationQuery => ({
  sql: `SELECT COUNT(*) AS columnCount
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}'`,
  expectedOutput: {
    columns: ["columnCount"],
    rows: [{ columnCount }],
  },
});

const primaryKeyCountVerification = (
  tableName: string,
  primaryKeyColumns: number,
): VerificationQuery => ({
  sql: `SELECT COUNT(*) AS primaryKeyColumns
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = '${tableName}'
  AND CONSTRAINT_NAME = 'PRIMARY'`,
  expectedOutput: {
    columns: ["primaryKeyColumns"],
    rows: [{ primaryKeyColumns }],
  },
});

const foreignKeyCountVerification = (
  tableName: string,
  foreignKeyColumns: number,
): VerificationQuery => ({
  sql: `SELECT COUNT(*) AS foreignKeyColumns
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = '${tableName}'
  AND REFERENCED_TABLE_NAME IS NOT NULL`,
  expectedOutput: {
    columns: ["foreignKeyColumns"],
    rows: [{ foreignKeyColumns }],
  },
});

const tableVerifications = (
  tableName: string,
  columnCount: number,
  primaryKeyColumns: number,
  foreignKeyColumns = 0,
) => [
  tableExistsVerification(tableName),
  columnCountVerification(tableName, columnCount),
  primaryKeyCountVerification(tableName, primaryKeyColumns),
  foreignKeyCountVerification(tableName, foreignKeyColumns),
];

export const exercises = [
  {
    id: "1.1",
    part: "Exercise 1 - Database Creation Script",
    order: 1,
    title: "Create CUSTOMER table",
    description:
      "Create the CUSTOMER table with an auto-increment primary key, customer name, address, and a unique email address.",
    type: "ddl",
    hints: [
      "Start with the entity that has no foreign keys.",
      "customerId should identify each row and auto-increment.",
      "The email column should be unique because two customers should not share an email address.",
    ],
    solutionQueries: [customerTableSql],
    verificationQueries: tableVerifications("CUSTOMER", 4, 1),
    initialCode: "CREATE TABLE CUSTOMER (\n  \n);",
  },
  {
    id: "1.2",
    part: "Exercise 1 - Database Creation Script",
    order: 2,
    title: "Create SUBSCRIBER table",
    description:
      "Create the SUBSCRIBER table. Each phone line is identified by phoneNumber and belongs to one CUSTOMER through customerId.",
    type: "ddl",
    hints: [
      "phoneNumber is the primary key for a subscriber line.",
      "customerId is required and references CUSTOMER(customerId).",
      "Use ON UPDATE CASCADE and ON DELETE CASCADE for the customer relationship.",
    ],
    solutionQueries: [subscriberTableSql],
    verificationQueries: tableVerifications("SUBSCRIBER", 8, 1, 1),
    initialCode: "CREATE TABLE SUBSCRIBER (\n  \n);",
  },
  {
    id: "1.3",
    part: "Exercise 1 - Database Creation Script",
    order: 3,
    title: "Create RECHARGE table",
    description:
      "Create the RECHARGE table. Each recharge belongs to a subscriber line and has a positive amount.",
    type: "ddl",
    hints: [
      "Use an auto-increment rechargeId as the primary key.",
      "phoneNumber references SUBSCRIBER(phoneNumber).",
      "The amount should be constrained to values greater than zero.",
    ],
    solutionQueries: [rechargeTableSql],
    verificationQueries: tableVerifications("RECHARGE", 5, 1, 1),
    initialCode: "CREATE TABLE RECHARGE (\n  \n);",
  },
  {
    id: "1.4",
    part: "Exercise 1 - Database Creation Script",
    order: 4,
    title: "Create SERVICE table",
    description:
      "Create the SERVICE table with an identifier and a required service name.",
    type: "ddl",
    hints: [
      "SERVICE has no foreign keys.",
      "serviceId should auto-increment.",
      "serviceName is required because every service needs a label.",
    ],
    solutionQueries: [serviceTableSql],
    verificationQueries: tableVerifications("SERVICE", 2, 1),
    initialCode: "CREATE TABLE SERVICE (\n  \n);",
  },
  {
    id: "1.5",
    part: "Exercise 1 - Database Creation Script",
    order: 5,
    title: "Create USAGE table",
    description:
      "Create the USAGE table. A usage event is identified by phoneNumber, serviceId, and usageDateTime. Use backticks around `USAGE` because it is a MySQL reserved word.",
    type: "ddl",
    hints: [
      "This table links SUBSCRIBER and SERVICE.",
      "The primary key is composite: phoneNumber, serviceId, usageDateTime.",
      "Use backticks: CREATE TABLE `USAGE` (...).",
    ],
    solutionQueries: [usageTableSql],
    verificationQueries: tableVerifications("USAGE", 6, 3, 2),
    initialCode: "CREATE TABLE `USAGE` (\n  \n);",
  },
  {
    id: "1.6",
    part: "Exercise 1 - Database Creation Script",
    order: 6,
    title: "Create PLAN table",
    description:
      "Create the PLAN table with a plan name and non-negative monthly rate.",
    type: "ddl",
    hints: [
      "PLAN has no foreign keys.",
      "planId should auto-increment.",
      "monthlyRate should not accept negative values.",
    ],
    solutionQueries: [planTableSql],
    verificationQueries: tableVerifications("PLAN", 3, 1),
    initialCode: "CREATE TABLE PLAN (\n  \n);",
  },
  {
    id: "1.7",
    part: "Exercise 1 - Database Creation Script",
    order: 7,
    title: "Create FEATURE table",
    description: "Create the FEATURE table. Each feature belongs to one PLAN.",
    type: "ddl",
    hints: [
      "Use featureId as the auto-increment primary key.",
      "planId references PLAN(planId).",
      "featureName is required.",
    ],
    solutionQueries: [featureTableSql],
    verificationQueries: tableVerifications("FEATURE", 3, 1, 1),
    initialCode: "CREATE TABLE FEATURE (\n  \n);",
  },
  {
    id: "1.8",
    part: "Exercise 1 - Database Creation Script",
    order: 8,
    title: "Create SUBSCRIPTION table",
    description:
      "Create the SUBSCRIPTION table. A subscription links a subscriber line to a plan for a date range.",
    type: "ddl",
    hints: [
      "The primary key is composite: phoneNumber, planId, startDate.",
      "phoneNumber references SUBSCRIBER and planId references PLAN.",
      "Add a check constraint so startDate is before endDate.",
    ],
    solutionQueries: [subscriptionTableSql],
    verificationQueries: tableVerifications("SUBSCRIPTION", 5, 3, 2),
    initialCode: "CREATE TABLE SUBSCRIPTION (\n  \n);",
  },
  {
    id: "1.9",
    part: "Exercise 1 - Database Creation Script",
    order: 9,
    title: "Full database creation script",
    description:
      "Write the complete SQL creation script for the DZTelecom database, including all tables, primary keys, foreign keys, and constraints.",
    type: "ddl",
    hints: [
      "Create independent tables first: CUSTOMER, SERVICE, and PLAN.",
      "Create tables with foreign keys only after the referenced tables exist.",
      "Remember to backtick `USAGE` because it is reserved in MySQL.",
    ],
    solutionQueries: [fullCreationScript],
    verificationQueries: [
      {
        sql: `SELECT COUNT(*) AS tableCount
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('CUSTOMER', 'SUBSCRIBER', 'RECHARGE', 'SERVICE', 'USAGE', 'PLAN', 'FEATURE', 'SUBSCRIPTION')`,
        expectedOutput: {
          columns: ["tableCount"],
          rows: [{ tableCount: 8 }],
        },
      },
      ...tableVerifications("SUBSCRIPTION", 5, 3, 2),
      ...tableVerifications("USAGE", 6, 3, 2),
    ],
    initialCode: "CREATE DATABASE IF NOT EXISTS DZTelecom;\nUSE DZTelecom;\n\n",
  },
  {
    id: "2.1.1",
    part: "Exercise 2 - Part 1",
    order: 10,
    title: "Active subscribers",
    description:
      "Display the phone number, customer name, and operatorName of all subscribers whose lineStatus is 'Active'.",
    type: "dql",
    hints: [
      "The line status is stored in SUBSCRIBER.",
      "The customer name is stored in CUSTOMER.",
      "Join SUBSCRIBER.customerId to CUSTOMER.customerId, then filter on lineStatus.",
    ],
    solutionQueries: [
      `SELECT s.phoneNumber, c.customerName, s.operatorName
FROM SUBSCRIBER s
JOIN CUSTOMER c ON c.customerId = s.customerId
WHERE s.lineStatus = 'Active'`,
      `SELECT s.phoneNumber, c.customerName, s.operatorName
FROM SUBSCRIBER s, CUSTOMER c
WHERE c.customerId = s.customerId
  AND s.lineStatus = 'Active'`,
    ],
    initialCode: "SELECT \nFROM \nWHERE ",
  },
  {
    id: "2.1.2",
    part: "Exercise 2 - Part 1",
    order: 11,
    title: "Highest monthly rate plan",
    description:
      "Find the plan with the highest monthlyRate. Display planName and monthlyRate.",
    type: "dql",
    hints: [
      "The values are stored in PLAN.",
      "Sort monthlyRate from highest to lowest.",
      "Use LIMIT 1 or compare with MAX(monthlyRate).",
    ],
    solutionQueries: [
      `SELECT planName, monthlyRate
FROM PLAN
ORDER BY monthlyRate DESC
LIMIT 1`,
      `SELECT planName, monthlyRate
FROM PLAN
WHERE monthlyRate = (SELECT MAX(monthlyRate) FROM PLAN)`,
    ],
    initialCode: "SELECT planName, monthlyRate\nFROM PLAN\n",
  },
  {
    id: "2.1.3",
    part: "Exercise 2 - Part 1",
    order: 12,
    title: "Subscriber count per operator",
    description: "Count the number of subscribers for each operatorName.",
    type: "dql",
    hints: [
      "The operator is stored directly on SUBSCRIBER.",
      "You need GROUP BY.",
      "COUNT(*) gives the number of subscriber rows per operatorName.",
    ],
    solutionQueries: [
      `SELECT operatorName, COUNT(*) AS subscriberCount
FROM SUBSCRIBER
GROUP BY operatorName`,
    ],
    initialCode:
      "SELECT operatorName, COUNT(*) AS subscriberCount\nFROM SUBSCRIBER\nGROUP BY ",
  },
  {
    id: "2.1.4",
    part: "Exercise 2 - Part 1",
    order: 13,
    title: "Services never used",
    description:
      "List all services that have never been used. Display serviceId and serviceName.",
    type: "dql",
    hints: [
      "Every usage event references a serviceId.",
      "Use SERVICE as the left table so unused services are kept.",
      "Filter where the matching `USAGE` row is NULL.",
    ],
    solutionQueries: [
      `SELECT s.serviceId, s.serviceName
FROM SERVICE s
LEFT JOIN \`USAGE\` u ON u.serviceId = s.serviceId
WHERE u.serviceId IS NULL`,
      `SELECT serviceId, serviceName
FROM SERVICE
WHERE serviceId NOT IN (SELECT DISTINCT serviceId FROM \`USAGE\`)`,
    ],
    initialCode: "SELECT serviceId, serviceName\nFROM SERVICE\n",
  },
  {
    id: "2.1.5",
    part: "Exercise 2 - Part 1",
    order: 14,
    title: "Customers with no mobile lines",
    description:
      "Find customers who do not have any mobile lines. Display customerName.",
    type: "dql",
    hints: [
      "A mobile line is represented by a SUBSCRIBER row.",
      "Start from CUSTOMER and look for missing SUBSCRIBER rows.",
      "LEFT JOIN plus IS NULL is a common anti-join pattern.",
    ],
    solutionQueries: [
      `SELECT c.customerName
FROM CUSTOMER c
LEFT JOIN SUBSCRIBER s ON s.customerId = c.customerId
WHERE s.phoneNumber IS NULL`,
      `SELECT customerName
FROM CUSTOMER c
WHERE NOT EXISTS (
  SELECT 1
  FROM SUBSCRIBER s
  WHERE s.customerId = c.customerId
)`,
    ],
    initialCode: "SELECT c.customerName\nFROM CUSTOMER c\n",
  },
  {
    id: "2.2.1",
    part: "Exercise 2 - Part 2",
    order: 15,
    title: "Subscribers with at least two plans",
    description:
      "Find subscribers who have subscribed to at least two different plans. Display customerName, phoneNumber, and the number of plans.",
    type: "dql",
    hints: [
      "The plan subscriptions are stored in SUBSCRIPTION.",
      "Join SUBSCRIPTION to SUBSCRIBER and CUSTOMER.",
      "Group by subscriber and use HAVING COUNT(DISTINCT planId) >= 2.",
    ],
    solutionQueries: [
      `SELECT c.customerName, s.phoneNumber, COUNT(DISTINCT sub.planId) AS planCount
FROM CUSTOMER c
JOIN SUBSCRIBER s ON s.customerId = c.customerId
JOIN SUBSCRIPTION sub ON sub.phoneNumber = s.phoneNumber
GROUP BY c.customerName, s.phoneNumber
HAVING COUNT(DISTINCT sub.planId) >= 2`,
    ],
    initialCode:
      "SELECT c.customerName, s.phoneNumber, COUNT(DISTINCT sub.planId) AS planCount\nFROM ",
  },
  {
    id: "2.2.2",
    part: "Exercise 2 - Part 2",
    order: 16,
    title: "Service/operator usage stats",
    description:
      "For each service and operatorName, calculate total call duration in hours, total data consumption in GB, and total cost. Display operatorName, serviceName, totalHours, totalDataGB, and totalCost.",
    type: "dql",
    hints: [
      "Join `USAGE` to SERVICE and SUBSCRIBER.",
      "callDuration is stored in minutes, so divide by 60.",
      "dataBytes is in bytes, so divide by 1024 * 1024 * 1024.",
    ],
    solutionQueries: [
      `SELECT s.operatorName, srv.serviceName,
       SUM(u.callDuration) / 60 AS totalHours,
       SUM(u.dataBytes) / POW(1024, 3) AS totalDataGB,
       SUM(u.amount) AS totalCost
FROM \`USAGE\` u
JOIN SUBSCRIBER s ON s.phoneNumber = u.phoneNumber
JOIN SERVICE srv ON srv.serviceId = u.serviceId
GROUP BY s.operatorName, srv.serviceName`,
    ],
    initialCode:
      "SELECT s.operatorName, srv.serviceName,\n       \nFROM `USAGE` u\n",
  },
  {
    id: "2.2.3",
    part: "Exercise 2 - Part 2",
    order: 17,
    title: "Subscribers with no active subscription",
    description:
      "Find subscribers who do not have any active subscription. In this schema, active means a SUBSCRIPTION row with endDate > CURRENT_DATE. Display phoneNumber and customerName.",
    type: "dql",
    hints: [
      "A subscriber can have zero or many SUBSCRIPTION rows.",
      "Use NOT EXISTS to reject subscribers with a current subscription.",
      "Join CUSTOMER to display customerName.",
    ],
    solutionQueries: [
      `SELECT s.phoneNumber, c.customerName
FROM SUBSCRIBER s
JOIN CUSTOMER c ON c.customerId = s.customerId
WHERE NOT EXISTS (
  SELECT 1
  FROM SUBSCRIPTION sub
  WHERE sub.phoneNumber = s.phoneNumber
    AND sub.endDate > CURRENT_DATE
)`,
    ],
    initialCode: "SELECT s.phoneNumber, c.customerName\nFROM SUBSCRIBER s\n",
  },
  {
    id: "2.2.4",
    part: "Exercise 2 - Part 2",
    order: 18,
    title: "Plan feature counts",
    description:
      "List all plans with the number of features they offer. Display planName and featureCount, sorted from most features to least.",
    type: "dql",
    hints: [
      "The features are stored in FEATURE.",
      "Use LEFT JOIN so plans with zero features would still appear.",
      "Sort the count in descending order.",
    ],
    solutionQueries: [
      `SELECT p.planName, COUNT(f.featureId) AS featureCount
FROM PLAN p
LEFT JOIN FEATURE f ON f.planId = p.planId
GROUP BY p.planId, p.planName
ORDER BY featureCount DESC`,
    ],
    initialCode:
      "SELECT p.planName, COUNT(f.featureId) AS featureCount\nFROM PLAN p\n",
  },
  {
    id: "2.3.1",
    part: "Exercise 2 - Part 3",
    order: 19,
    title: "Subscribers who used every service",
    description:
      "Find subscribers who have used every available service at least once. Display phoneNumber and customerName.",
    type: "dql",
    hints: [
      "This is a division-style query.",
      "For every service, there must exist a matching usage row for the subscriber.",
      "You can solve it with double NOT EXISTS or with COUNT(DISTINCT serviceId).",
    ],
    solutionQueries: [
      `SELECT s.phoneNumber, c.customerName
FROM SUBSCRIBER s
JOIN CUSTOMER c ON c.customerId = s.customerId
WHERE NOT EXISTS (
  SELECT 1
  FROM SERVICE srv
  WHERE NOT EXISTS (
    SELECT 1
    FROM \`USAGE\` u
    WHERE u.phoneNumber = s.phoneNumber
      AND u.serviceId = srv.serviceId
  )
)`,
      `SELECT s.phoneNumber, c.customerName
FROM SUBSCRIBER s
JOIN CUSTOMER c ON c.customerId = s.customerId
JOIN \`USAGE\` u ON u.phoneNumber = s.phoneNumber
GROUP BY s.phoneNumber, c.customerName
HAVING COUNT(DISTINCT u.serviceId) = (SELECT COUNT(*) FROM SERVICE)`,
    ],
    initialCode: "SELECT s.phoneNumber, c.customerName\nFROM SUBSCRIBER s\n",
  },
  {
    id: "2.3.2",
    part: "Exercise 2 - Part 3",
    order: 20,
    title: "Highest revenue service",
    description:
      "Determine which service generated the highest total revenue. Display serviceId, serviceName, and totalRevenue.",
    type: "dql",
    hints: [
      "Revenue is stored as amount on `USAGE`.",
      "Group usage rows by service.",
      "Sort SUM(amount) descending and take the first row.",
    ],
    solutionQueries: [
      `SELECT srv.serviceId, srv.serviceName, SUM(u.amount) AS totalRevenue
FROM SERVICE srv
JOIN \`USAGE\` u ON u.serviceId = srv.serviceId
GROUP BY srv.serviceId, srv.serviceName
ORDER BY totalRevenue DESC
LIMIT 1`,
      `SELECT srv.serviceId, srv.serviceName, SUM(u.amount) AS totalRevenue
FROM SERVICE srv
JOIN \`USAGE\` u ON u.serviceId = srv.serviceId
GROUP BY srv.serviceId, srv.serviceName
HAVING SUM(u.amount) >= ALL (
  SELECT SUM(amount)
  FROM \`USAGE\`
  GROUP BY serviceId
)`,
    ],
    initialCode:
      "SELECT srv.serviceId, srv.serviceName, SUM(u.amount) AS totalRevenue\nFROM SERVICE srv\n",
  },
  {
    id: "2.3.3",
    part: "Exercise 2 - Part 3",
    order: 21,
    title: "Subscriber with max call duration",
    description:
      "Find the subscriber whose total callDuration exceeds that of all other subscribers. Display customerName, phoneNumber, and totalCallDuration.",
    type: "dql",
    hints: [
      "Sum callDuration per subscriber.",
      "Join CUSTOMER for customerName.",
      "Sort totalCallDuration descending and use LIMIT 1.",
    ],
    solutionQueries: [
      `SELECT c.customerName, s.phoneNumber, SUM(u.callDuration) AS totalCallDuration
FROM CUSTOMER c
JOIN SUBSCRIBER s ON s.customerId = c.customerId
JOIN \`USAGE\` u ON u.phoneNumber = s.phoneNumber
GROUP BY c.customerName, s.phoneNumber
ORDER BY totalCallDuration DESC
LIMIT 1`,
    ],
    initialCode:
      "SELECT c.customerName, s.phoneNumber, SUM(u.callDuration) AS totalCallDuration\nFROM ",
  },
  {
    id: "2.3.4",
    part: "Exercise 2 - Part 3",
    order: 22,
    title: "Above-average data consumers",
    description:
      "Find subscribers whose total data consumption is greater than the average total data consumption across all subscribers. Display phoneNumber, customerName, and totalDataConsumed.",
    type: "dql",
    hints: [
      "First compute total data per subscriber.",
      "Include subscribers with zero usage by using LEFT JOIN.",
      "Compare each subscriber total to the average of all subscriber totals.",
    ],
    solutionQueries: [
      `SELECT totals.phoneNumber, totals.customerName, totals.totalDataConsumed
FROM (
  SELECT s.phoneNumber, c.customerName, COALESCE(SUM(u.dataBytes), 0) AS totalDataConsumed
  FROM SUBSCRIBER s
  JOIN CUSTOMER c ON c.customerId = s.customerId
  LEFT JOIN \`USAGE\` u ON u.phoneNumber = s.phoneNumber
  GROUP BY s.phoneNumber, c.customerName
) totals
WHERE totals.totalDataConsumed > (
  SELECT AVG(perSubscriber.totalDataConsumed)
  FROM (
    SELECT s2.phoneNumber, COALESCE(SUM(u2.dataBytes), 0) AS totalDataConsumed
    FROM SUBSCRIBER s2
    LEFT JOIN \`USAGE\` u2 ON u2.phoneNumber = s2.phoneNumber
    GROUP BY s2.phoneNumber
  ) perSubscriber
)`,
    ],
    initialCode:
      "SELECT phoneNumber, customerName, totalDataConsumed\nFROM (\n  \n) totals\nWHERE ",
  },
  {
    id: "2.3.5",
    part: "Exercise 2 - Part 3",
    order: 23,
    title: "Monthly recharge stats for 2025",
    description:
      "For each month of 2025, show the number of recharges and total amount recharged. Display monthNumber, rechargeCount, and totalAmount, ordered by monthNumber.",
    type: "dql",
    hints: [
      "The sample data may not contain recharges in 2025, but every month should still appear.",
      "Build a derived table containing numbers 1 through 12.",
      "LEFT JOIN RECHARGE filtered to year 2025 and group by the month number.",
    ],
    solutionQueries: [
      `SELECT months.monthNumber,
       COUNT(r.rechargeId) AS rechargeCount,
       COALESCE(SUM(r.amount), 0) AS totalAmount
FROM (
  SELECT 1 AS monthNumber UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
  UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12
) months
LEFT JOIN RECHARGE r
  ON MONTH(r.rechargeDate) = months.monthNumber
 AND YEAR(r.rechargeDate) = 2025
GROUP BY months.monthNumber
ORDER BY months.monthNumber`,
      `WITH RECURSIVE months AS (
  SELECT 1 AS monthNumber
  UNION ALL
  SELECT monthNumber + 1 FROM months WHERE monthNumber < 12
)
SELECT months.monthNumber,
       COUNT(r.rechargeId) AS rechargeCount,
       COALESCE(SUM(r.amount), 0) AS totalAmount
FROM months
LEFT JOIN RECHARGE r
  ON MONTH(r.rechargeDate) = months.monthNumber
 AND YEAR(r.rechargeDate) = 2025
GROUP BY months.monthNumber
ORDER BY months.monthNumber`,
    ],
    initialCode: "SELECT monthNumber, rechargeCount, totalAmount\nFROM ",
  },
  {
    id: "2.4.1",
    part: "Exercise 2 - Part 4",
    order: 24,
    title: "Add isCall column to USAGE",
    description:
      "Add a boolean isCall column to `USAGE`, update it to TRUE for rows whose serviceName is 'Appel National', FALSE for all other services, then make it NOT NULL.",
    type: "ddl",
    hints: [
      "First add the column allowing NULL values temporarily.",
      "Use an UPDATE with a JOIN from `USAGE` to SERVICE to identify 'Appel National'.",
      "After values are filled, modify the column to BOOLEAN NOT NULL.",
    ],
    solutionQueries: [
      `ALTER TABLE \`USAGE\` ADD COLUMN isCall BOOLEAN NULL;
UPDATE \`USAGE\` u
JOIN SERVICE s ON s.serviceId = u.serviceId
SET u.isCall = (s.serviceName = 'Appel National');
ALTER TABLE \`USAGE\` MODIFY COLUMN isCall BOOLEAN NOT NULL;`,
    ],
    verificationQueries: [
      {
        sql: `SELECT COLUMN_NAME AS columnName, IS_NULLABLE AS isNullable
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'USAGE'
  AND COLUMN_NAME = 'isCall'`,
        expectedOutput: {
          columns: ["columnName", "isNullable"],
          rows: [{ columnName: "isCall", isNullable: "NO" }],
        },
      },
      {
        sql: `SELECT
  SUM(CASE WHEN isCall = TRUE THEN 1 ELSE 0 END) AS callRows,
  SUM(CASE WHEN isCall = FALSE THEN 1 ELSE 0 END) AS nonCallRows
FROM \`USAGE\``,
        expectedOutput: {
          columns: ["callRows", "nonCallRows"],
          rows: [{ callRows: 1, nonCallRows: 4 }],
        },
      },
    ],
    allowAlter: true,
    initialCode: "ALTER TABLE `USAGE` ADD COLUMN isCall BOOLEAN NULL;\n",
  },
  {
    id: "2.4.2",
    part: "Exercise 2 - Part 4",
    order: 25,
    title: "Create activeSubscribers view",
    description:
      "Create a view called activeSubscribers containing active subscribers with customerId, customerName, phoneNumber, balance, operatorName, lineType, lineStatus, activationDate, and simCode. Add WITH CHECK OPTION.",
    type: "ddl",
    hints: [
      "The view needs columns from CUSTOMER and SUBSCRIBER.",
      "Filter with lineStatus = 'Active'.",
      "Use WITH CHECK OPTION so updates through the view cannot violate the active condition.",
    ],
    solutionQueries: [
      `CREATE VIEW activeSubscribers AS
SELECT c.customerId, c.customerName,
       s.phoneNumber, s.balance, s.operatorName, s.lineType,
       s.lineStatus, s.activationDate, s.simCode
FROM CUSTOMER c
JOIN SUBSCRIBER s ON s.customerId = c.customerId
WHERE s.lineStatus = 'Active'
WITH CHECK OPTION`,
    ],
    verificationQueries: [
      {
        sql: `SELECT TABLE_NAME AS viewName, CHECK_OPTION AS checkOption
FROM INFORMATION_SCHEMA.VIEWS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'activeSubscribers'`,
        expectedOutput: {
          columns: ["viewName", "checkOption"],
          rows: [{ viewName: "activeSubscribers", checkOption: "CASCADED" }],
        },
      },
      {
        sql: "SELECT COUNT(*) AS activeSubscriberCount FROM activeSubscribers",
        expectedOutput: {
          columns: ["activeSubscriberCount"],
          rows: [{ activeSubscriberCount: 3 }],
        },
      },
    ],
    allowAlter: true,
    initialCode:
      "CREATE VIEW activeSubscribers AS\nSELECT \nFROM \nWHERE \nWITH CHECK OPTION;",
  },
  {
    id: "2.4.3",
    part: "Exercise 2 - Part 4",
    order: 26,
    title: "Add UNIQUE constraint on simCode",
    description:
      "Add a UNIQUE constraint on SUBSCRIBER.simCode so no two subscribers can have the same SIM card code.",
    type: "ddl",
    hints: [
      "The column already exists on SUBSCRIBER.",
      "Use ALTER TABLE to add a unique constraint.",
      "Name the constraint clearly, for example uq_subscriber_simCode.",
    ],
    solutionQueries: [
      "ALTER TABLE SUBSCRIBER ADD CONSTRAINT uq_subscriber_simCode UNIQUE (simCode)",
    ],
    verificationQueries: [
      {
        sql: `SELECT COUNT(*) AS uniqueConstraintCount
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
  ON kcu.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
 AND kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
 AND kcu.TABLE_NAME = tc.TABLE_NAME
WHERE tc.TABLE_SCHEMA = DATABASE()
  AND tc.TABLE_NAME = 'SUBSCRIBER'
  AND tc.CONSTRAINT_TYPE = 'UNIQUE'
  AND kcu.COLUMN_NAME = 'simCode'`,
        expectedOutput: {
          columns: ["uniqueConstraintCount"],
          rows: [{ uniqueConstraintCount: 1 }],
        },
      },
    ],
    allowAlter: true,
    initialCode:
      "ALTER TABLE SUBSCRIBER ADD CONSTRAINT uq_subscriber_simCode UNIQUE (simCode);",
  },
] satisfies Exercise[];

export function getExercise(id: string) {
  return exercises.find((exercise) => exercise.id === id) ?? null;
}

export function getExerciseSummaries(): ExerciseSummary[] {
  return exercises.map(({ id, part, order, title, type, allowAlter }) => ({
    id,
    part,
    order,
    title,
    type,
    allowAlter,
  }));
}

export function getExercisesByPart(): ExerciseGroup[] {
  const groups = new Map<string, ExerciseSummary[]>();

  for (const exercise of getExerciseSummaries()) {
    const group = groups.get(exercise.part) ?? [];
    group.push(exercise);
    groups.set(exercise.part, group);
  }

  return Array.from(groups.entries()).map(([part, groupedExercises]) => ({
    part,
    exercises: [...groupedExercises].sort((a, b) => a.order - b.order),
  }));
}

export function getNextExerciseId(id: string) {
  const index = exercises.findIndex((exercise) => exercise.id === id);
  return index === -1 ? null : (exercises[index + 1]?.id ?? null);
}

export function getPreviousExerciseId(id: string) {
  const index = exercises.findIndex((exercise) => exercise.id === id);
  return index === -1 ? null : (exercises[index - 1]?.id ?? null);
}

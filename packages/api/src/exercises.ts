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

const usesTableSql = `CREATE TABLE USES (
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

const signupTableSql = `CREATE TABLE SIGNUP (
    phoneNumber VARCHAR(20) NOT NULL,
    planId INT NOT NULL,
    startDate DATE NOT NULL,
    endDate DATE NOT NULL,
    amount DECIMAL(10,2) DEFAULT 0,
    PRIMARY KEY (phoneNumber, planId, startDate),
    CONSTRAINT chk_dates CHECK (startDate < endDate),
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
);`;

const fullCreationScript = [
  baseCreateDatabasePrefix,
  customerTableSql,
  subscriberTableSql,
  rechargeTableSql,
  serviceTableSql,
  usesTableSql,
  planTableSql,
  featureTableSql,
  signupTableSql,
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
      "CUSTOMER is independent, so create it before tables that reference customers.",
      "Use customerId as an INT primary key with AUTO_INCREMENT.",
      "Make customerName required, and add a UNIQUE constraint on email so two customers cannot share the same address.",
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
      "A subscriber line is identified by phoneNumber, not by an auto-generated id.",
      "The customerId column connects each line to CUSTOMER(customerId), so CUSTOMER must already exist.",
      "Keep customerId NOT NULL and add the foreign key with cascading update/delete behavior.",
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
      "Each recharge is its own event, so use rechargeId as an AUTO_INCREMENT primary key.",
      "The recharge belongs to a line through phoneNumber, which should reference SUBSCRIBER(phoneNumber).",
      "Add a CHECK constraint on amount so zero or negative recharges are rejected.",
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
      "SERVICE is a lookup table, so it can be created before USES.",
      "Use serviceId as the primary key and make it auto-increment.",
      "serviceName should be NOT NULL because every usage row will point to a named service.",
    ],
    solutionQueries: [serviceTableSql],
    verificationQueries: tableVerifications("SERVICE", 2, 1),
    initialCode: "CREATE TABLE SERVICE (\n  \n);",
  },
  {
    id: "1.5",
    part: "Exercise 1 - Database Creation Script",
    order: 5,
    title: "Create USES table",
    description:
      "Create the USES table. A usage event is identified by phoneNumber, serviceId, and usageDateTime.",
    type: "ddl",
    hints: [
      "USES records a subscriber using a service at a specific date and time.",
      "Use a composite primary key on phoneNumber, serviceId, and usageDateTime to identify one usage event.",
      "The table is named USES so students can write it normally without backticks.",
    ],
    solutionQueries: [usesTableSql],
    verificationQueries: tableVerifications("USES", 6, 3, 2),
    initialCode: "CREATE TABLE USES (\n  \n);",
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
      "PLAN is independent and can be created before FEATURE and SIGNUP.",
      "Use planId as the AUTO_INCREMENT primary key and keep planName required.",
      "monthlyRate is a price-like value, so add a constraint that prevents negative rates.",
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
      "FEATURE belongs to PLAN, so create PLAN first.",
      "Use featureId as the primary key and store the owning plan in planId.",
      "Add a foreign key from FEATURE(planId) to PLAN(planId), and make featureName required.",
    ],
    solutionQueries: [featureTableSql],
    verificationQueries: tableVerifications("FEATURE", 3, 1, 1),
    initialCode: "CREATE TABLE FEATURE (\n  \n);",
  },
  {
    id: "1.8",
    part: "Exercise 1 - Database Creation Script",
    order: 8,
    title: "Create SIGNUP table",
    description:
      "Create the SIGNUP table. A signup links a subscriber line to a plan for a date range.",
    type: "ddl",
    hints: [
      "SIGNUP is an association table between subscriber lines and plans.",
      "Use a composite primary key with phoneNumber, planId, and startDate so a line can sign up for the same plan at different periods.",
      "Reference both SUBSCRIBER and PLAN, and add a date constraint so startDate comes before endDate.",
    ],
    solutionQueries: [signupTableSql],
    verificationQueries: tableVerifications("SIGNUP", 5, 3, 2),
    initialCode: "CREATE TABLE SIGNUP (\n  \n);",
  },
  {
    id: "1.9",
    part: "Exercise 1 - Database Creation Script",
    order: 9,
    title: "Full database creation script",
    description:
      "Consider the Entity-Relationship (ER) schema provided above, and write the SQL creation script required to generate the database. Your script must include the definition of all tables, primary keys, foreign keys, and any necessary constraints.",
    type: "ddl",
    hints: [
      "Start with tables that have no foreign keys: CUSTOMER, SERVICE, and PLAN.",
      "Then create dependent tables in an order that respects references: SUBSCRIBER, RECHARGE, FEATURE, USES, and SIGNUP.",
      "Check every relationship from the ER diagram: primary keys, foreign keys, composite keys, and constraints such as positive amounts and valid date ranges.",
    ],
    solutionQueries: [fullCreationScript],
    verificationQueries: [
      {
        sql: `SELECT COUNT(*) AS tableCount
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('CUSTOMER', 'SUBSCRIBER', 'RECHARGE', 'SERVICE', 'USES', 'PLAN', 'FEATURE', 'SIGNUP')`,
        expectedOutput: {
          columns: ["tableCount"],
          rows: [{ tableCount: 8 }],
        },
      },
      ...tableVerifications("SIGNUP", 5, 3, 2),
      ...tableVerifications("USES", 6, 3, 2),
    ],
    initialCode: "CREATE DATABASE IF NOT EXISTS DZTelecom;\nUSE DZTelecom;\n\n",
  },
  {
    id: "2.1.1",
    part: "Exercise 2 - Part 1",
    order: 10,
    title: "Active subscribers",
    description:
      "Write an SQL query to display the phone number, customer name, and operator of all subscribers whose line status is 'Active'.",
    type: "dql",
    hints: [
      "The filter column lineStatus is in SUBSCRIBER; the customer name is in CUSTOMER.",
      "Join CUSTOMER and SUBSCRIBER through their shared customerId.",
      "Only keep rows where lineStatus is exactly 'Active', then select phoneNumber, customerName, and operatorName.",
    ],
    solutionQueries: [
      `SELECT s.phoneNumber, c.customerName, s.operatorName
FROM CUSTOMER c
NATURAL JOIN SUBSCRIBER s
WHERE s.lineStatus = 'Active'`,
      `SELECT s.phoneNumber, c.customerName, s.operatorName
FROM SUBSCRIBER s
JOIN CUSTOMER c ON c.customerId = s.customerId
WHERE s.lineStatus = 'Active'`,
    ],
    initialCode: "SELECT \nFROM \nWHERE ",
  },
  {
    id: "2.1.2",
    part: "Exercise 2 - Part 1",
    order: 11,
    title: "Highest monthly rate plan",
    description:
      "Write an SQL query to find the plan with the highest monthly rate. Display the plan name and monthly rate.",
    type: "dql",
    hints: [
      "Both columns you need are in PLAN.",
      "Do not select MAX(monthlyRate) directly with planName; that gives an aggregate value, not the monthlyRate column from the winning row.",
      "Use MAX(monthlyRate) in a subquery inside WHERE, then return the plan row whose monthlyRate equals that maximum.",
    ],
    solutionQueries: [
      `SELECT planName, monthlyRate
FROM PLAN
WHERE monthlyRate = (SELECT MAX(monthlyRate) FROM PLAN)`,
    ],
    initialCode:
      "SELECT planName, monthlyRate\nFROM PLAN\nWHERE monthlyRate = (\n  \n);",
  },
  {
    id: "2.1.3",
    part: "Exercise 2 - Part 1",
    order: 12,
    title: "Subscriber count per operator",
    description:
      "Write an SQL query to count the number of subscribers for each operator. Display the operator name and the count.",
    type: "dql",
    hints: [
      "Each subscriber row already contains its operatorName.",
      "Group rows by operatorName so each operator becomes one result row.",
      "COUNT(phoneNumber) or COUNT(*) gives the number of subscriber lines in each group.",
    ],
    solutionQueries: [
      `SELECT operatorName, COUNT(phoneNumber) AS NumberSubscriber
FROM SUBSCRIBER
GROUP BY operatorName`,
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
      "Write an SQL query to list all services that have never been used. Display the service ID and service name.",
    type: "dql",
    hints: [
      "A service has been used only if its serviceId appears in USES.",
      "Start from SERVICE, because you want services even when no matching usage row exists.",
      "Use either LEFT JOIN ... IS NULL or NOT EXISTS to keep services with no matching USES record.",
    ],
    solutionQueries: [
      `SELECT s.serviceId, s.serviceName
FROM SERVICE s
LEFT JOIN USES u ON u.serviceId = s.serviceId
WHERE u.serviceId IS NULL`,
      `SELECT serviceId, serviceName
FROM SERVICE
WHERE serviceId NOT IN (SELECT DISTINCT serviceId FROM USES)`,
    ],
    initialCode: "SELECT serviceId, serviceName\nFROM SERVICE\n",
  },
  {
    id: "2.1.5",
    part: "Exercise 2 - Part 1",
    order: 14,
    title: "Customers with no mobile lines",
    description:
      "Write an SQL query to find customers who do not have any mobile lines. Display the customer name.",
    type: "dql",
    hints: [
      "A customer has a mobile line if there is at least one SUBSCRIBER row for their customerId.",
      "Start from CUSTOMER, then look for customers with no related subscriber line.",
      "NOT EXISTS is a clean way to express this, and LEFT JOIN ... IS NULL is an equivalent alternative.",
    ],
    solutionQueries: [
      `SELECT c.customerName
FROM CUSTOMER c
WHERE NOT EXISTS (
  SELECT 1
  FROM SUBSCRIBER s
  WHERE s.customerId = c.customerId
)`,
      `SELECT c.customerName
FROM CUSTOMER c
LEFT JOIN SUBSCRIBER s ON s.customerId = c.customerId
WHERE s.phoneNumber IS NULL`,
    ],
    initialCode: "SELECT c.customerName\nFROM CUSTOMER c\n",
  },
  {
    id: "2.2.1",
    part: "Exercise 2 - Part 2",
    order: 15,
    title: "Subscribers with at least two plans",
    description:
      "Write an SQL query to find subscribers who have signed up for at least two different plans. Display the customer name, phone number, and the number of plans they have signed up for.",
    type: "dql",
    hints: [
      "The table that records plan signups is SIGNUP.",
      "Join SIGNUP to SUBSCRIBER for phoneNumber, then to CUSTOMER for customerName.",
      "Group by the subscriber line and use HAVING to keep only groups with at least two plans.",
    ],
    solutionQueries: [
      `SELECT DISTINCT c.customerName, s.phoneNumber, COUNT(su.planId) AS nombrePlan
FROM SIGNUP su
JOIN SUBSCRIBER s ON su.phoneNumber = s.phoneNumber
JOIN CUSTOMER c ON c.customerId = s.customerId
GROUP BY s.phoneNumber
HAVING nombrePlan >= 2`,
      `SELECT DISTINCT c.customerName, s.phoneNumber, COUNT(DISTINCT su.planId) AS nombrePlan
FROM SUBSCRIBER s
JOIN SIGNUP su ON s.phoneNumber = su.phoneNumber
JOIN CUSTOMER c ON c.customerId = s.customerId
GROUP BY s.phoneNumber
HAVING nombrePlan >= 2`,
    ],
    initialCode:
      "SELECT c.customerName, s.phoneNumber, COUNT(DISTINCT su.planId) AS planCount\nFROM SIGNUP su\n",
  },
  {
    id: "2.2.2",
    part: "Exercise 2 - Part 2",
    order: 16,
    title: "Service/operator usage stats",
    description: `Write an SQL query to calculate for each service and each operator:
- Total call duration in hours (callDuration is in minutes)
- Total data consumption in GB (dataBytes is in bytes, 1 GB = 1024³ bytes)
- Total cost

Display operator, service name, total hours, total data in GB, and total cost.`,
    type: "dql",
    hints: [
      "Each row in USES has the quantities to sum; SERVICE gives serviceName and SUBSCRIBER gives operatorName.",
      "Group by both service and operator so every service/operator pair has its own totals.",
      "Convert callDuration with / 60 for hours, convert bytes with / POWER(1024, 3) for GB, and SUM amount for total cost.",
    ],
    solutionQueries: [
      `SELECT s.operatorName, srv.serviceName,
       SUM(u.callDuration) / 60 AS totalCallDuration,
       SUM(u.dataBytes) / POWER(1024, 3) AS totalDataByte,
       SUM(u.amount) AS totalCost
FROM USES u
JOIN SUBSCRIBER s ON s.phoneNumber = u.phoneNumber
JOIN SERVICE srv ON srv.serviceId = u.serviceId
GROUP BY srv.serviceId, s.operatorName`,
    ],
    initialCode:
      "SELECT s.operatorName, srv.serviceName,\n       \nFROM USES u\n",
  },
  {
    id: "2.2.3",
    part: "Exercise 2 - Part 2",
    order: 17,
    title: "Subscribers with no active signup",
    description:
      "Write an SQL query to find subscribers who do not have any active signup (no signup record with endDate = NULL). Display the phone number and customer name.",
    type: "dql",
    hints: [
      "The document defines an active signup as a SIGNUP row whose endDate is NULL.",
      "Find subscriber lines for which no such active row exists.",
      "Join CUSTOMER so the final result can display customerName next to phoneNumber.",
    ],
    solutionQueries: [
      `SELECT s.phoneNumber, c.customerName
FROM SUBSCRIBER s
JOIN CUSTOMER c ON c.customerId = s.customerId
WHERE s.phoneNumber NOT IN (
  SELECT DISTINCT phoneNumber
  FROM SIGNUP su
  WHERE su.endDate IS NULL
)`,
      `SELECT s.phoneNumber, c.customerName
FROM SUBSCRIBER s
JOIN CUSTOMER c ON c.customerId = s.customerId
WHERE NOT EXISTS (
  SELECT 1
  FROM SIGNUP su
  WHERE su.phoneNumber = s.phoneNumber
    AND su.endDate IS NULL
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
      "Write an SQL query to list all plans along with the count of features they offer. Display the plan name and number of features, sorted from most features to least.",
    type: "dql",
    hints: [
      "PLAN contains planName; FEATURE contains one row per feature offered by a plan.",
      "Join PLAN to FEATURE on planId, then group by each plan.",
      "Count featureId and order that count descending so the most feature-rich plans appear first.",
    ],
    solutionQueries: [
      `SELECT p.planName, COUNT(f.featureId) AS nombreFeature
FROM PLAN p
JOIN FEATURE f ON p.planId = f.planId
GROUP BY p.planId
ORDER BY nombreFeature DESC`,
      `SELECT p.planName, COUNT(f.featureId) AS NumberFeature
FROM PLAN p
JOIN FEATURE f ON p.planId = f.planId
GROUP BY p.planId
ORDER BY NumberFeature DESC`,
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
      "Write an SQL query to find subscribers who have used every available service at least once. Display the phone number and customer name.",
    type: "dql",
    hints: [
      "This is the SQL division pattern: find subscribers related to all services.",
      "One route is to count DISTINCT serviceId used by each phoneNumber.",
      "Compare that count to the total number of rows in SERVICE; equality means the subscriber used every service.",
    ],
    solutionQueries: [
      `SELECT s.phoneNumber, c.customerName
FROM SUBSCRIBER s
JOIN CUSTOMER c ON c.customerId = s.customerId
JOIN USES u ON u.phoneNumber = s.phoneNumber
GROUP BY s.phoneNumber, c.customerName
HAVING COUNT(DISTINCT u.serviceId) = (SELECT COUNT(*) FROM SERVICE)`,
      `SELECT s.phoneNumber, c.customerName
FROM SUBSCRIBER s
JOIN CUSTOMER c ON c.customerId = s.customerId
WHERE (
  SELECT COUNT(DISTINCT u.serviceId)
  FROM USES u
  WHERE u.phoneNumber = s.phoneNumber
) = (
  SELECT COUNT(*)
  FROM SERVICE
)`,
    ],
    initialCode: "SELECT s.phoneNumber, c.customerName\nFROM SUBSCRIBER s\n",
  },
  {
    id: "2.3.2",
    part: "Exercise 2 - Part 3",
    order: 20,
    title: "Highest revenue service",
    description:
      "Write an SQL query to determine which service has generated the highest total revenue. Display the service ID, service name, and total revenue.",
    type: "dql",
    hints: [
      "Revenue for a usage event is stored in USES.amount.",
      "Join SERVICE to USES, group by service, and compute SUM(amount).",
      "Use a nested subquery to find the maximum service total, then keep the service whose total equals it.",
    ],
    solutionQueries: [
      `SELECT srv.serviceId, srv.serviceName, SUM(u.amount) AS total_revenue
FROM SERVICE srv
JOIN USES u ON u.serviceId = srv.serviceId
GROUP BY srv.serviceId, srv.serviceName
HAVING SUM(u.amount) = (
  SELECT MAX(total_revenue)
  FROM (
    SELECT SUM(amount) AS total_revenue
    FROM USES
    GROUP BY serviceId
  ) AS revenue_per_service
)`,
      `SELECT srv.serviceId, srv.serviceName, SUM(u.amount) AS totalRevenue
FROM SERVICE srv
JOIN USES u ON u.serviceId = srv.serviceId
GROUP BY srv.serviceId, srv.serviceName
HAVING SUM(u.amount) >= ALL (
  SELECT SUM(amount)
  FROM USES
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
      "Write an SQL query to find the subscriber whose total call duration exceeds that of all other subscribers. Display the customer name, phone number, and total call duration.",
    type: "dql",
    hints: [
      "First build the total callDuration for each phoneNumber.",
      "Join SUBSCRIBER to CUSTOMER so the final result includes customerName.",
      "Use HAVING with a subquery that returns the maximum per-subscriber total duration.",
    ],
    solutionQueries: [
      `SELECT c.customerName, s.phoneNumber, SUM(u.callDuration) AS totalCallDuration
FROM CUSTOMER c
JOIN SUBSCRIBER s ON s.customerId = c.customerId
JOIN USES u ON u.phoneNumber = s.phoneNumber
GROUP BY s.phoneNumber
HAVING SUM(u.callDuration) = (
  SELECT MAX(totalCallDuration)
  FROM (
    SELECT SUM(callDuration) AS totalCallDuration
    FROM USES
    GROUP BY phoneNumber
  ) AS totalDuration
)`,
      `SELECT c.customerName, s.phoneNumber, SUM(u.callDuration) AS totalCallDuration
FROM USES u
JOIN SUBSCRIBER s ON s.phoneNumber = u.phoneNumber
JOIN CUSTOMER c ON c.customerId = s.customerId
GROUP BY phoneNumber
HAVING totalCallDuration >= ALL (
  SELECT SUM(callDuration)
  FROM USES
  GROUP BY phoneNumber
)`,
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
      "Write an SQL query to find subscribers whose total data consumption is greater than the average data consumption across all subscribers. Display the phone number, customer name, and total data consumed.",
    type: "dql",
    hints: [
      "You need two levels of aggregation: one total data amount per subscriber, then the average of those totals.",
      "SUM dataBytes grouped by phoneNumber gives each subscriber's total consumption.",
      "Use HAVING to compare each subscriber's SUM(dataBytes) against the AVG from a derived table.",
    ],
    solutionQueries: [
      `SELECT c.customerName, s.phoneNumber, SUM(u.dataBytes) AS totalDataConsp
FROM CUSTOMER c
JOIN SUBSCRIBER s ON c.customerId = s.customerId
JOIN USES u ON u.phoneNumber = s.phoneNumber
GROUP BY c.customerName, s.phoneNumber
HAVING SUM(u.dataBytes) > (
  SELECT AVG(averageConsp.totalDataConsp)
  FROM (
    SELECT SUM(dataBytes) AS totalDataConsp
    FROM USES
    GROUP BY phoneNumber
  ) averageConsp
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
      "Write an SQL query to show, for each month of the year 2025, the number of recharges performed and the total amount recharged. Display the month number, number of recharges, and total amount, ordered by month.",
    type: "dql",
    hints: [
      "The result should contain all 12 months, even months without recharges.",
      "Create a small derived table or recursive CTE containing month numbers 1 through 12.",
      "LEFT JOIN RECHARGE for rows in year 2025, then COUNT rechargeId and COALESCE the SUM(amount) to 0.",
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
    ],
    initialCode: "SELECT monthNumber, rechargeCount, totalAmount\nFROM ",
  },
  {
    id: "2.4.1",
    part: "Exercise 2 - Part 4",
    order: 24,
    title: "Add isCall field to USES",
    description: `Add an isCall field to the USES table.

Write the SQL statements to:

1. Add a boolean column called isCall to the USES table (temporarily allowing NULL values).
2. Update this column to TRUE for records where the service is 'Calls', and FALSE for all other services.
3. Modify the column to be NOT NULL.`,
    type: "ddl",
    hints: [
      "Do this in three steps: add the column, fill every existing row, then make the column NOT NULL.",
      "The app schema calls the table USES, so write ALTER TABLE USES directly.",
      "Use SERVICE to identify call rows. In this seed data, the call service is named 'Appel National'.",
    ],
    solutionQueries: [
      `ALTER TABLE USES ADD COLUMN isCall BOOLEAN NULL;
UPDATE USES
SET isCall = CASE
  WHEN serviceId = (
    SELECT serviceId
    FROM SERVICE
    WHERE serviceName = 'Appel National'
  ) THEN TRUE
  ELSE FALSE
END;
ALTER TABLE USES MODIFY COLUMN isCall BOOLEAN NOT NULL;`,
      `ALTER TABLE USES ADD COLUMN isCall BOOLEAN NULL;
UPDATE USES u
JOIN SERVICE s ON s.serviceId = u.serviceId
SET u.isCall = (s.serviceName = 'Appel National');
ALTER TABLE USES MODIFY COLUMN isCall BOOLEAN NOT NULL;`,
    ],
    verificationQueries: [
      {
        sql: `SELECT COLUMN_NAME AS columnName, IS_NULLABLE AS isNullable
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'USES'
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
FROM USES`,
        expectedOutput: {
          columns: ["callRows", "nonCallRows"],
          rows: [{ callRows: 5, nonCallRows: 20 }],
        },
      },
    ],
    allowAlter: true,
    initialCode: "ALTER TABLE USES ADD COLUMN isCall BOOLEAN NULL;\n",
  },
  {
    id: "2.4.2",
    part: "Exercise 2 - Part 4",
    order: 25,
    title: "Create activeSubscribers view",
    description: `Write an SQL statement to create a view called activeSubscribers that displays all active subscribers (lineStatus = 'Active'). The view should include:

- customerId, customerName
- phoneNumber, balance, operator, lineType, lineStatus, activationDate, simCode

Include the WITH CHECK OPTION to prevent updates that would violate the active status condition.`,
    type: "ddl",
    hints: [
      "A view is a saved SELECT query, so start by writing the SELECT for active subscribers.",
      "CUSTOMER provides customerId and customerName; SUBSCRIBER provides the line details.",
      "Place WITH CHECK OPTION at the end so updates through the view must still satisfy lineStatus = 'Active'.",
    ],
    solutionQueries: [
      `CREATE VIEW activeSubscribers AS
SELECT c.customerId, c.customerName,
       s.phoneNumber, s.balance, s.operatorName, s.lineType, s.lineStatus,
       s.activationDate, s.simCode
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
          rows: [{ activeSubscriberCount: 5 }],
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
      "Write an SQL statement to add a unique constraint on the simCode column in the SUBSCRIBER table to ensure no two subscribers have the same SIM card code.",
    type: "ddl",
    hints: [
      "simCode is already a column on SUBSCRIBER, so you only need to change the table constraint.",
      "Use ALTER TABLE ... ADD CONSTRAINT ... UNIQUE (simCode).",
      "Give the constraint a clear name; the teacher file uses a name like unique_simCode.",
    ],
    solutionQueries: [
      "ALTER TABLE SUBSCRIBER ADD CONSTRAINT unique_simCode UNIQUE (simCode)",
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

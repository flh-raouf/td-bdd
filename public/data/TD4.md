# 1CS-BDD SQL Language

**ESI (2025/2026)**

## Database Context

"TelecomDZ" is a mobile phone operator in Algeria that manages a vast number of customers. These customers can acquire multiple telephone lines (SIM cards). The operator considers each line as a subscriber, identified by a unique phone number. A subscriber is categorized as either prepaid or postpaid (`lineType`). The activation of the phone number occurs on a specific date, and the line status is classified as either active or suspended. The operator offers various plans (for example: Twenty Premium, Hayla Bezzef, or Hanya). Each plan has a monthly rate. A line subscriber can sign up for multiple plans, with each subscription valid from `startDate` to `endDate`. Each plan provides access to a set of specific features (for example: MobiPass, DataPass, or SMSData Pass). The operator offers its line subscribers different services, such as calls, SMS, International Roaming, Voicemail, or Data Packets. For every instance a subscriber uses a service, the operator captures the date and time of use, the duration of calls, the volume of data consumed (in octets), and the resulting cost.

![TelecomDZ ER schema](/public/assets/telecomdz-er-schema.png)

## Exercise 1. Database Creation Script (DDL)

Consider the Entity-Relationship (ER) schema provided above, and write the SQL creation script required to generate the database. Your script must include the definition of all tables, primary keys, foreign keys, and any necessary constraints.

## Exercise 2

### Part 1

1. Write an SQL query to display the phone number, customer name, and operator of all subscribers whose line status is `'Active'`.
2. Write an SQL query to find the plan with the highest monthly rate. Display the plan name and monthly rate.
3. Write an SQL query to count the number of subscribers for each operator. Display the operator name and the count.
4. Write an SQL query to list all services that have never been used. Display the service ID and service name.
5. Write an SQL query to find customers who do not have any mobile lines. Display the customer name.

### Part 2

1. Write an SQL query to find subscribers who have subscribed to at least two different plans. Display the customer name, phone number, and the number of plans they have subscribed to.
2. Write an SQL query to calculate for each service and each operator:
   - Total call duration in hours (`callDuration` is in minutes)
   - Total data consumption in GB (`dataBytes` is in bytes, 1 GB = 1024³ bytes)
   - Total cost

   Display operator, service name, total hours, total data in GB, and total cost.
3. Write an SQL query to find subscribers who do not have any active subscription (no subscription record with `endDate = NULL`). Display the phone number and customer name.
4. Write an SQL query to list all plans along with the count of features they offer. Display the plan name and number of features, sorted from most features to least.

### Part 3

1. Write an SQL query to find subscribers who have used every available service at least once. Display the phone number and customer name.
2. Write an SQL query to determine which service has generated the highest total revenue. Display the service ID, service name, and total revenue.
3. Write an SQL query to find the subscriber whose total call duration exceeds that of all other subscribers. Display the customer name, phone number, and total call duration.
4. Write an SQL query to find subscribers whose total data consumption is greater than the average data consumption across all subscribers. Display the phone number, customer name, and total data consumed.
5. Write an SQL query to show, for each month of the year 2025, the number of recharges performed and the total amount recharged. Display the month number, number of recharges, and total amount, ordered by month.

### Part 4

1. **Add an `isCall` field to the `SERVICE_USAGE` table.**

   Write the SQL statements to:

   1. Add a boolean column called `isCall` to the `SERVICE_USAGE` table (temporarily allowing `NULL` values).
   2. Update this column to `TRUE` for records where the service is `'Calls'`, and `FALSE` for all other services.
   3. Modify the column to be `NOT NULL`.

2. Write an SQL statement to create a view called `activeSubscribers` that displays all active subscribers (`lineStatus = 'Active'`). The view should include:

   - `customerId`, `customerName`
   - `phoneNumber`, `balance`, `operator`, `lineType`, `lineStatus`, `activationDate`, `simCode`

   Include the `WITH CHECK OPTION` to prevent updates that would violate the active status condition.

3. Write an SQL statement to add a unique constraint on the `simCode` column in the `SUBSCRIBER` table to ensure no two subscribers have the same SIM card code.

---

BERKANI N. - FADLOUN S. - KHOURI S.

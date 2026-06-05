import {
  date,
  datetime,
  decimal,
  float,
  int,
  mysqlTable,
  primaryKey,
  text,
  varchar,
} from "drizzle-orm/mysql-core";

export const customer = mysqlTable("CUSTOMER", {
  customerId: int("customerId").autoincrement().primaryKey(),
  customerName: varchar("customerName", { length: 150 }).notNull(),
  address: text("address"),
  email: varchar("email", { length: 150 }).unique(),
});

export const subscriber = mysqlTable("SUBSCRIBER", {
  phoneNumber: varchar("phoneNumber", { length: 20 }).primaryKey(),
  customerId: int("customerId")
    .notNull()
    .references(() => customer.customerId, {
      onUpdate: "cascade",
      onDelete: "cascade",
    }),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0"),
  operatorName: varchar("operatorName", { length: 100 }),
  lineType: varchar("lineType", { length: 50 }),
  lineStatus: varchar("lineStatus", { length: 50 }),
  activationDate: date("activationDate", { mode: "string" }),
  simCode: varchar("simCode", { length: 100 }),
});

export const recharge = mysqlTable("RECHARGE", {
  rechargeId: int("rechargeId").autoincrement().primaryKey(),
  phoneNumber: varchar("phoneNumber", { length: 20 })
    .notNull()
    .references(() => subscriber.phoneNumber, {
      onUpdate: "cascade",
      onDelete: "cascade",
    }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  rechargeDate: date("rechargeDate", { mode: "string" }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
});

export const service = mysqlTable("SERVICE", {
  serviceId: int("serviceId").autoincrement().primaryKey(),
  serviceName: varchar("serviceName", { length: 150 }).notNull(),
});

export const uses = mysqlTable(
  "USES",
  {
    phoneNumber: varchar("phoneNumber", { length: 20 })
      .notNull()
      .references(() => subscriber.phoneNumber, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    serviceId: int("serviceId")
      .notNull()
      .references(() => service.serviceId, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    usageDateTime: datetime("usageDateTime", { mode: "string" }).notNull(),
    callDuration: int("callDuration").default(0),
    dataBytes: float("dataBytes").default(0),
    amount: decimal("amount", { precision: 10, scale: 2 }).default("0"),
  },
  (table) => [
    primaryKey({
      columns: [table.phoneNumber, table.serviceId, table.usageDateTime],
    }),
  ],
);

export const plan = mysqlTable("PLAN", {
  planId: int("planId").autoincrement().primaryKey(),
  planName: varchar("planName", { length: 150 }).notNull(),
  monthlyRate: decimal("monthlyRate", { precision: 10, scale: 2 }).notNull(),
});

export const feature = mysqlTable("FEATURE", {
  featureId: int("featureId").autoincrement().primaryKey(),
  planId: int("planId")
    .notNull()
    .references(() => plan.planId, {
      onUpdate: "cascade",
      onDelete: "cascade",
    }),
  featureName: varchar("featureName", { length: 150 }).notNull(),
});

export const signup = mysqlTable(
  "SIGNUP",
  {
    phoneNumber: varchar("phoneNumber", { length: 20 })
      .notNull()
      .references(() => subscriber.phoneNumber, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    planId: int("planId")
      .notNull()
      .references(() => plan.planId, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    startDate: date("startDate", { mode: "string" }).notNull(),
    endDate: date("endDate", { mode: "string" }).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).default("0"),
  },
  (table) => [
    primaryKey({ columns: [table.phoneNumber, table.planId, table.startDate] }),
  ],
);

import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').default('user').notNull(), // 'admin' or 'user'
  createdAt: timestamp('created_at').defaultNow(),
});

export const serviceRequests = pgTable('service_requests', {
  id: serial('id').primaryKey(),
  bikeId: integer('bike_id')
    .references(() => bikes.id, { onDelete: 'cascade' })
    .notNull(),
  bikeReg: text('bike_reg').notNull(),
  requestedBy: text('requested_by').notNull(), // User email
  serviceType: text('service_type').notNull(),
  problemDescription: text('problem_description').notNull(),
  status: text('status').default('pending').notNull(), // 'pending', 'done', 'cancelled'
  dateRequested: text('date_requested').notNull(), // YYYY-MM-DD
  createdAt: timestamp('created_at').defaultNow(),
});

export const bikes = pgTable('bikes', {
  id: serial('id').primaryKey(),
  regNo: text('reg_no').notNull().unique(),
  province: text('province').notNull(),
  district: text('district').notNull(),
  model: text('model').notNull(),
  officer: text('officer').notNull(),
  dateAdded: text('date_added').notNull(), // YYYY-MM-DD
  createdAt: timestamp('created_at').defaultNow(),
});

export const sparesInventory = pgTable('spares_inventory', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  quantity: integer('quantity').notNull(),
  dateAdded: text('date_added').notNull(), // YYYY-MM-DD
  addedBy: text('added_by').notNull(), // admin user who added it
  createdAt: timestamp('created_at').defaultNow(),
});

export const serviceLogs = pgTable('service_logs', {
  id: serial('id').primaryKey(),
  bikeId: integer('bike_id')
    .references(() => bikes.id, { onDelete: 'cascade' })
    .notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  nextServiceDate: text('next_service_date'), // YYYY-MM-DD
  nextServiceMileage: integer('next_service_mileage'),
  mileage: integer('mileage').notNull(),
  officer: text('officer').notNull(),
  province: text('province').notNull(),
  district: text('district').notNull(),
  workDone: text('work_done'),
  workPending: text('work_pending'),
  status: text('status').notNull(), // 'done' or 'pending'
  createdAt: timestamp('created_at').defaultNow(),
});

export const serviceLogSpares = pgTable('service_log_spares', {
  id: serial('id').primaryKey(),
  serviceLogId: integer('service_log_id')
    .references(() => serviceLogs.id, { onDelete: 'cascade' })
    .notNull(),
  spareId: integer('spare_id')
    .references(() => sparesInventory.id, { onDelete: 'set null' }),
  spareName: text('spare_name').notNull(),
  quantity: integer('quantity').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const bikesRelations = relations(bikes, ({ many }) => ({
  serviceLogs: many(serviceLogs),
}));

export const serviceLogsRelations = relations(serviceLogs, ({ one, many }) => ({
  bike: one(bikes, {
    fields: [serviceLogs.bikeId],
    references: [bikes.id],
  }),
  spares: many(serviceLogSpares),
}));

export const serviceLogSparesRelations = relations(serviceLogSpares, ({ one }) => ({
  serviceLog: one(serviceLogs, {
    fields: [serviceLogSpares.serviceLogId],
    references: [serviceLogs.id],
  }),
  spare: one(sparesInventory, {
    fields: [serviceLogSpares.spareId],
    references: [sparesInventory.id],
  }),
}));




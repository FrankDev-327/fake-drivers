import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

export const dbdatasource: DataSourceOptions = {
  type: 'postgres',
  // compose passes one connection string per service (postgresql://user:pass@postgres:5432/<service>_db)
  url: process.env.DATABASE_URL,
  // console, not a file: the container runs as the non-root node user and can't write to /app
  logger: 'advanced-console',
  maxQueryExecutionTime: 1000, // logs slow queries
  entities: ['dist/**/*.entity{.ts,.js}'],
  // orm.ts sits at the project root, so nest builds into dist/src
  migrations: ['dist/src/migrations/*{.ts,.js}'],
  // apply pending migrations when the service boots (the database itself is created by postgres/init)
  migrationsRun: true,
  subscribers: [],
  logging: process.env.NODE_ENV !== 'production',
};

const dataSource = new DataSource(dbdatasource);
export default dataSource;

import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

export const dbdatasource: DataSourceOptions = {
  type: 'postgres',
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST,
  logger: 'file',
  maxQueryExecutionTime: 1000, //will log slow queries
  entities: ['dist/**/*.entity{.ts,.js}'],
  migrations: ['dist/src/migrations/*{.ts,.js}'],
  subscribers: [],
  logging: process.env.NODE_ENV !== 'prod',
};

const dataSource = new DataSource(dbdatasource);
export default dataSource;
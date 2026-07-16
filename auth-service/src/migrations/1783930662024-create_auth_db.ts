import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import logger from "../../looger"; 

export class CreateAuthDb1783930662024 implements MigrationInterface {

      async up(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.createDatabase('user_db', true);
      logger.info('Database user_db created or already exists');
 
      await queryRunner.createTable(
        new Table({
          name: 'users',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'gen_random_uuid()',
            },
            {
              name: 'email',
              type: 'varchar',
              length: '255',
              isUnique: true,
              isNullable: false,
            },
            {
              name: 'password',
              type: 'varchar',
              length: '255',
              isNullable: false,
            },
            {
              name: 'name',
              type: 'varchar',
              length: '255',
              isNullable: false,
            },
            {
              name: 'role',
              type: 'enum',
              enum: ['rider', 'driver'],
              isNullable: false,
            },
            {
              name: 'created_at',
              type: 'timestamp',
              default: 'now()',
              isNullable: false,
            },
            {
              name: 'updated_at',
              type: 'timestamp',
              default: 'now()',
              isNullable: false,
            },
          ],
        }),
        true,
      );

      logger.info('Table users created');
      await queryRunner.createIndex(
        'users',
        new TableIndex({
          name: 'idx_users_email',
          columnNames: ['email'],
        }),
      );

      logger.info('Index idx_users_email created');
    } catch (error) {
      logger.error('Migration InitAuthService up failed', {
        error: (error as Error).message,
      });
    }
  }


async down(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.dropIndex('users', 'idx_users_email');
      logger.info('Index idx_users_email dropped');
 
      await queryRunner.dropTable('users', true);
      logger.info('Table users dropped');
 
    } catch (error) {
      logger.error('Migration InitAuthService down failed', {
        error: (error as Error).message,
      });;
    }
  }
}

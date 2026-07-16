import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import logger from '../../logger';

export class CreateRiderDb1784011482225 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.createDatabase('rider_db', true);
      logger.info('Database rider_db created or already exists');

      await queryRunner.createTable(
        new Table({
          name: 'riders',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'gen_random_uuid()',
            },
            {
              name: 'user_id',
              type: 'varchar',
              length: '255',
              isUnique: true,
              isNullable: false,
            },
            {
              name: 'name',
              type: 'varchar',
              length: '255',
              isNullable: false,
            },
            {
              name: 'email',
              type: 'varchar',
              length: '255',
              isUnique: true,
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
      logger.info('Table riders created');

      await queryRunner.createIndex(
        'riders',
        new TableIndex({
          name: 'idx_riders_user_id',
          columnNames: ['user_id'],
        }),
      );

      await queryRunner.createIndex(
        'riders',
        new TableIndex({
          name: 'idx_riders_email',
          columnNames: ['email'],
        }),
      );

      logger.info('Indexes for riders table created');
    } catch (error) {
      logger.error('Migration InitRiderService up failed', {
        error: (error as Error).message,
      });
      return;
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.dropIndex('riders', 'idx_riders_email');
      await queryRunner.dropIndex('riders', 'idx_riders_user_id');
      await queryRunner.dropTable('riders', true);
      logger.info('Table riders dropped');
    } catch (error) {
      logger.error('Migration InitRiderService down failed', {
        error: (error as Error).message,
      });
      return;
    }
  }
}

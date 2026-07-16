import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import logger from '../../logger';

export class InitRideService1720000000003 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.createDatabase('ride_db', true);
            logger.info('Database ride_db created or already exists');

            await queryRunner.createTable(
                new Table({
                    name: 'rides',
                    columns: [
                        {
                            name: 'id',
                            type: 'uuid',
                            isPrimary: true,
                            generationStrategy: 'uuid',
                            default: 'gen_random_uuid()',
                        },
                        {
                            name: 'rider_id',
                            type: 'uuid',
                            isNullable: false,
                        },
                        {
                            name: 'driver_id',
                            type: 'uuid',
                            isNullable: true,
                        },
                        {
                            name: 'status',
                            type: 'enum',
                            enum: ['requested', 'matched', 'in_progress', 'completed', 'cancelled'],
                            default: "'requested'",
                            isNullable: false,
                        },
                        {
                            name: 'pickup_lat',
                            type: 'float',
                            isNullable: false,
                        },
                        {
                            name: 'pickup_lng',
                            type: 'float',
                            isNullable: false,
                        },
                        {
                            name: 'destination_lat',
                            type: 'float',
                            isNullable: false,
                        },
                        {
                            name: 'destination_lng',
                            type: 'float',
                            isNullable: false,
                        },
                        {
                            name: 'fare',
                            type: 'float',
                            isNullable: true,
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
            logger.info('Table rides created');

            await queryRunner.createIndex('rides', new TableIndex({ name: 'idx_rides_rider_id', columnNames: ['rider_id'] }));
            await queryRunner.createIndex('rides', new TableIndex({ name: 'idx_rides_driver_id', columnNames: ['driver_id'] }));
            await queryRunner.createIndex('rides', new TableIndex({ name: 'idx_rides_status', columnNames: ['status'] }));

            logger.info('Indexes for rides table created');
        } catch (error) {
            logger.error('Migration InitRideService up failed', { error: (error as Error).message });
        }
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.dropIndex('rides', 'idx_rides_status');
            await queryRunner.dropIndex('rides', 'idx_rides_driver_id');
            await queryRunner.dropIndex('rides', 'idx_rides_rider_id');
            await queryRunner.dropTable('rides', true);
            logger.info('Table rides dropped');
        } catch (error) {
            logger.error('Migration InitRideService down failed', { error: (error as Error).message });
        }
    }
}
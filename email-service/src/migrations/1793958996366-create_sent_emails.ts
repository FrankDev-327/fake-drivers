import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateSentEmails1793958996366 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sent_emails',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
          { name: 'ride_id', type: 'uuid', isNullable: false },
          { name: 'user_id', type: 'varchar', length: '255', isNullable: false },
          { name: 'type', type: 'enum', enum: ['ride_receipt'], isNullable: false },
          { name: 'status', type: 'enum', enum: ['pending', 'sent', 'failed'], default: "'pending'", isNullable: false },
          { name: 'to_email', type: 'varchar', length: '255', isNullable: true },
          { name: 'subject', type: 'varchar', length: '255', isNullable: false },
          { name: 'ses_message_id', type: 'varchar', length: '255', isNullable: true },
          { name: 'attempts', type: 'int', default: 0, isNullable: false },
          { name: 'last_error', type: 'text', isNullable: true },
          { name: 'fare', type: 'float', isNullable: true },
          { name: 'pickup_lat', type: 'float', isNullable: true },
          { name: 'pickup_lng', type: 'float', isNullable: true },
          { name: 'destination_lat', type: 'float', isNullable: true },
          { name: 'destination_lng', type: 'float', isNullable: true },
          { name: 'ride_requested_at', type: 'timestamp', isNullable: true },
          { name: 'ride_completed_at', type: 'timestamp', isNullable: true },
          { name: 'sent_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamp', default: 'now()', isNullable: false },
        ],
      }),
      true,
    );

    // one receipt per ride: a redelivered ride.completed hits this and is skipped, never sent twice
    await queryRunner.createIndex(
      'sent_emails',
      new TableIndex({ name: 'uq_sent_emails_ride_type', columnNames: ['ride_id', 'type'], isUnique: true }),
    );
    // "my receipts" lists by user, newest first
    await queryRunner.createIndex(
      'sent_emails',
      new TableIndex({ name: 'idx_sent_emails_user_id', columnNames: ['user_id', 'created_at'] }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('sent_emails', 'idx_sent_emails_user_id');
    await queryRunner.dropIndex('sent_emails', 'uq_sent_emails_ride_type');
    await queryRunner.dropTable('sent_emails', true);
  }
}

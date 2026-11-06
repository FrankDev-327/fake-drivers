import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserPhotoKey1793947990877 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'photo_key',
        type: 'varchar',
        length: '512',
        isNullable: true,
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'photo_key');
  }
}

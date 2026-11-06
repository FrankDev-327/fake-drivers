import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddDriverHasPhoto1793947990878 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "drivers",
      new TableColumn({
        name: "has_photo",
        type: "boolean",
        default: false,
        isNullable: false,
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("drivers", "has_photo");
  }
}

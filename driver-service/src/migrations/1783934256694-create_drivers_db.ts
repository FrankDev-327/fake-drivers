import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";
import logger from "../../logger";

export class CreateDriversDb1783934256694 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.createDatabase("driver_db", true);
      logger.info("Database driver_db created or already exists");

      await queryRunner.createTable(
        new Table({
          name: "drivers",
          columns: [
            {
              name: "id",
              type: "uuid",
              isPrimary: true,
              generationStrategy: "uuid",
              default: "gen_random_uuid()",
            },
            {
              name: "user_id",
              type: "varchar",
              length: "255",
              isUnique: true,
              isNullable: false,
            },
            {
              name: "name",
              type: "varchar",
              length: "255",
              isNullable: false,
            },
            {
              name: "email",
              type: "varchar",
              length: "255",
              isUnique: true,
              isNullable: false,
            },
            {
              name: "status",
              type: "enum",
              enum: ["available", "busy", "offline"],
              default: "'offline'",
              isNullable: false,
            },
            {
              name: "lat",
              type: "float",
              isNullable: true,
            },
            {
              name: "lng",
              type: "float",
              isNullable: true,
            },
            {
              name: "created_at",
              type: "timestamp",
              default: "now()",
              isNullable: false,
            },
            {
              name: "updated_at",
              type: "timestamp",
              default: "now()",
              isNullable: false,
            },
          ],
        }),
        true,
      );
      logger.info("Table drivers created");

      await queryRunner.createIndex(
        "drivers",
        new TableIndex({
          name: "idx_drivers_user_id",
          columnNames: ["user_id"],
        }),
      );

      await queryRunner.createIndex(
        "drivers",
        new TableIndex({
          name: "idx_drivers_email",
          columnNames: ["email"],
        }),
      );

      await queryRunner.createIndex(
        "drivers",
        new TableIndex({
          name: "idx_drivers_status",
          columnNames: ["status"],
        }),
      );

      logger.info("Indexes for drivers table created");
    } catch (error) {
      logger.error("Migration InitDriverService up failed", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.dropIndex("drivers", "idx_drivers_status");
      await queryRunner.dropIndex("drivers", "idx_drivers_email");
      await queryRunner.dropIndex("drivers", "idx_drivers_user_id");
      await queryRunner.dropTable("drivers", true);
      logger.info("Table drivers dropped");
    } catch (error) {
      logger.error("Migration InitDriverService down failed", {
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

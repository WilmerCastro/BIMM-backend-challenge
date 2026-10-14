import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVehicleCatalog1791952000000 implements MigrationInterface {
  name = 'CreateVehicleCatalog1791952000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

    await queryRunner.query(`
      CREATE TABLE makes (
        make_id integer PRIMARY KEY,
        make_name text NOT NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX makes_name_id_idx ON makes (make_name, make_id)',
    );
    await queryRunner.query(
      'CREATE INDEX makes_name_trgm_idx ON makes USING gin (make_name gin_trgm_ops)',
    );

    await queryRunner.query(`
      CREATE TABLE vehicle_types (
        type_id integer PRIMARY KEY,
        type_name text NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE make_vehicle_types (
        make_id integer NOT NULL REFERENCES makes (make_id) ON DELETE CASCADE,
        type_id integer NOT NULL REFERENCES vehicle_types (type_id) ON DELETE CASCADE,
        PRIMARY KEY (make_id, type_id)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX make_vehicle_types_type_id_idx ON make_vehicle_types (type_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE make_vehicle_types');
    await queryRunner.query('DROP TABLE vehicle_types');
    await queryRunner.query('DROP TABLE makes');
  }
}

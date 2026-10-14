import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('vehicle_types')
export class VehicleTypeEntity {
  @PrimaryColumn({ name: 'type_id', type: 'integer' })
  typeId: number;

  @Column({ name: 'type_name', type: 'text' })
  typeName: string;
}

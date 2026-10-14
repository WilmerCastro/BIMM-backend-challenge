import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { MakeEntity } from './make.entity.js';
import { VehicleTypeEntity } from './vehicle-type.entity.js';

@Entity('make_vehicle_types')
export class MakeVehicleTypeEntity {
  @PrimaryColumn({ name: 'make_id', type: 'integer' })
  makeId: number;

  @PrimaryColumn({ name: 'type_id', type: 'integer' })
  typeId: number;

  @ManyToOne(() => MakeEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'make_id' })
  make?: MakeEntity;

  @ManyToOne(() => VehicleTypeEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'type_id' })
  vehicleType?: VehicleTypeEntity;
}

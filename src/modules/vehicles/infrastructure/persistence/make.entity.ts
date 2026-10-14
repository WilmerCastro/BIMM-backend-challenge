import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('makes')
export class MakeEntity {
  @PrimaryColumn({ name: 'make_id', type: 'integer' })
  makeId: number;

  @Column({ name: 'make_name', type: 'text' })
  makeName: string;
}

import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, type SelectQueryBuilder } from 'typeorm';
import { chunk } from '../../../../common/collections/chunk.js';
import type { Make, MakeSummary, VehicleType } from '../../domain/make.js';
import type {
  MakeFilter,
  MakePageQuery,
  MakeRepository,
} from '../../domain/make.repository.js';
import { MakeVehicleTypeEntity } from './make-vehicle-type.entity.js';
import { MakeEntity } from './make.entity.js';
import { VehicleTypeEntity } from './vehicle-type.entity.js';

const WRITE_CHUNK_SIZE = 1000;

const uniqueVehicleTypes = (makes: readonly Make[]): VehicleType[] => [
  ...new Map(
    makes.flatMap((make) => make.vehicleTypes).map((type) => [type.typeId, type]),
  ).values(),
];

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

const applyFilter = (
  query: SelectQueryBuilder<MakeEntity>,
  { name, vehicleTypeId }: MakeFilter,
) => {
  if (name !== undefined) {
    query.andWhere('make.make_name ILIKE :name', {
      name: `%${escapeLike(name)}%`,
    });
  }
  if (vehicleTypeId !== undefined) {
    query.andWhere(
      'EXISTS (SELECT 1 FROM make_vehicle_types link WHERE link.make_id = make.make_id AND link.type_id = :vehicleTypeId)',
      { vehicleTypeId },
    );
  }
  return query;
};

@Injectable()
export class TypeOrmMakeRepository implements MakeRepository {
  constructor(private readonly dataSource: DataSource) {}

  private get makes() {
    return this.dataSource.getRepository(MakeEntity);
  }

  async saveMakes(makes: readonly Make[]): Promise<void> {
    if (makes.length === 0) return;

    await this.dataSource.transaction(async (manager) => {
      for (const makesChunk of chunk(makes, WRITE_CHUNK_SIZE)) {
        await this.saveChunk(manager, makesChunk);
      }
    });
  }

  findMakes({ limit, after, ...filter }: MakePageQuery): Promise<MakeSummary[]> {
    const query = applyFilter(this.makes.createQueryBuilder('make'), filter)
      .orderBy('make.make_name', 'ASC')
      .addOrderBy('make.make_id', 'ASC')
      .limit(limit);

    if (after) {
      query.andWhere('(make.make_name, make.make_id) > (:afterName, :afterId)', {
        afterName: after.makeName,
        afterId: after.makeId,
      });
    }
    return query.getMany();
  }

  countMakes(filter: MakeFilter = {}): Promise<number> {
    return applyFilter(this.makes.createQueryBuilder('make'), filter).getCount();
  }

  findMakeById(makeId: number): Promise<MakeSummary | null> {
    return this.makes.findOneBy({ makeId });
  }

  async findVehicleTypesByMakeIds(
    makeIds: readonly number[],
  ): Promise<Map<number, VehicleType[]>> {
    const vehicleTypesByMakeId = new Map<number, VehicleType[]>();
    if (makeIds.length === 0) return vehicleTypesByMakeId;

    const rows: { makeId: number; typeId: number; typeName: string }[] =
      await this.dataSource
        .createQueryBuilder()
        .select('link.make_id', 'makeId')
        .addSelect('type.type_id', 'typeId')
        .addSelect('type.type_name', 'typeName')
        .from(MakeVehicleTypeEntity, 'link')
        .innerJoin(VehicleTypeEntity, 'type', 'type.type_id = link.type_id')
        .where('link.make_id IN (:...makeIds)', { makeIds })
        .orderBy('type.type_id', 'ASC')
        .getRawMany();

    for (const { makeId, typeId, typeName } of rows) {
      const vehicleTypes = vehicleTypesByMakeId.get(makeId) ?? [];
      vehicleTypes.push({ typeId, typeName });
      vehicleTypesByMakeId.set(makeId, vehicleTypes);
    }
    return vehicleTypesByMakeId;
  }

  findAllVehicleTypes(): Promise<VehicleType[]> {
    return this.dataSource
      .getRepository(VehicleTypeEntity)
      .find({ order: { typeId: 'ASC' } });
  }

  private async saveChunk(manager: EntityManager, makes: readonly Make[]) {
    const vehicleTypes = uniqueVehicleTypes(makes);
    if (vehicleTypes.length > 0) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(VehicleTypeEntity)
        .values(vehicleTypes)
        .orUpdate(['type_name'], ['type_id'])
        .execute();
    }

    await manager
      .createQueryBuilder()
      .insert()
      .into(MakeEntity)
      .values(makes.map(({ makeId, makeName }) => ({ makeId, makeName })))
      .orUpdate(['make_name'], ['make_id'])
      .execute();

    await manager.delete(MakeVehicleTypeEntity, {
      makeId: In(makes.map((make) => make.makeId)),
    });

    const links = makes.flatMap((make) =>
      make.vehicleTypes.map((type) => ({
        makeId: make.makeId,
        typeId: type.typeId,
      })),
    );
    if (links.length > 0) {
      await manager.insert(MakeVehicleTypeEntity, links);
    }
  }
}

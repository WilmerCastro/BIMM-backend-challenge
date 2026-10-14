import { Module } from '@nestjs/common';
import { VehicleCatalogService } from './application/vehicle-catalog.service.js';
import { MAKE_REPOSITORY } from './domain/make.repository.js';
import { TypeOrmMakeRepository } from './infrastructure/persistence/typeorm-make.repository.js';
import { MakesResolver } from './presentation/graphql/makes.resolver.js';
import { VehicleTypesLoaderFactory } from './presentation/graphql/vehicle-types.loader.js';

@Module({
  providers: [
    { provide: MAKE_REPOSITORY, useClass: TypeOrmMakeRepository },
    VehicleCatalogService,
    VehicleTypesLoaderFactory,
    MakesResolver,
  ],
  exports: [MAKE_REPOSITORY, VehicleTypesLoaderFactory],
})
export class VehiclesModule {}

import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'node:path';
import type { Env } from '../config/env.js';
import { VehicleTypesLoaderFactory } from '../modules/vehicles/presentation/graphql/vehicle-types.loader.js';
import { VehiclesModule } from '../modules/vehicles/vehicles.module.js';
import { createErrorFormatter } from './format-error.js';
import type { GraphQLContext } from './graphql.context.js';
import { InvalidInputFilter } from './invalid-input.filter.js';

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [VehiclesModule],
      inject: [ConfigService, VehicleTypesLoaderFactory],
      useFactory: (
        config: ConfigService<Env, true>,
        vehicleTypesLoaders: VehicleTypesLoaderFactory,
      ) => {
        const env = config.get('NODE_ENV', { infer: true });
        const isProduction = env === 'production';
        return {
          path: '/graphql',
          autoSchemaFile:
            env === 'development' ? join(process.cwd(), 'schema.gql') : true,
          sortSchema: true,
          introspection: true,
          playground: false,
          plugins: isProduction
            ? []
            : [ApolloServerPluginLandingPageLocalDefault()],
          includeStacktraceInErrorResponses: !isProduction,
          formatError: createErrorFormatter(isProduction),
          context: (): GraphQLContext => ({
            vehicleTypesLoader: vehicleTypesLoaders.create(),
          }),
        };
      },
    }),
  ],
  providers: [{ provide: APP_FILTER, useClass: InvalidInputFilter }],
})
export class GraphqlApiModule {}

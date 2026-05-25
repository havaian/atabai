import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MappingSeedService } from './mapping-seed.service';
import {
  EquityMappingConfig,
  EquityMappingConfigSchema,
} from './schemas/equity-mapping-config.schema';
import { MappingSet, MappingSetSchema } from './schemas/mapping-set.schema';
import { RowMapping, RowMappingSchema } from './schemas/row-mapping.schema';

/**
 * Owns the MappingSet / RowMapping / EquityMappingConfig Mongoose models and
 * the seed service. Marked global so the AdminMappingsService (in AdminModule)
 * and the mapping-resolver helpers (used by processors) can both use them
 * without re-importing.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MappingSet.name, schema: MappingSetSchema },
      { name: RowMapping.name, schema: RowMappingSchema },
      { name: EquityMappingConfig.name, schema: EquityMappingConfigSchema },
    ]),
  ],
  providers: [MappingSeedService],
  exports: [MongooseModule, MappingSeedService],
})
export class MappingsModule {}

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
class EquityColumn {
  @Prop({ type: String, required: true }) key!: string;
  @Prop({ type: String, required: true }) label!: string;
  @Prop({ type: [String], default: [] }) nsbuRows!: string[];
  @Prop({ type: Boolean, default: false }) isNegative!: boolean;
  @Prop({ type: Boolean, default: false }) isCalculated!: boolean;
}
const EquityColumnSchema = SchemaFactory.createForClass(EquityColumn);

@Schema({ _id: false })
class EquityMovementRow {
  @Prop({ type: String, required: true }) key!: string;
  @Prop({ type: String, required: true }) label!: string;
  @Prop({ type: Boolean, default: false }) isTotal!: boolean;
}
const EquityMovementRowSchema = SchemaFactory.createForClass(EquityMovementRow);

@Schema({ _id: false })
class RegexPattern {
  @Prop({ type: String, required: true }) key!: string;
  @Prop({ type: String, required: true }) pattern!: string;
  @Prop({ type: String, default: 'i' }) flags!: string;
}
const RegexPatternSchema = SchemaFactory.createForClass(RegexPattern);

export type EquityMappingConfigDocument = HydratedDocument<EquityMappingConfig>;

@Schema({ timestamps: true })
export class EquityMappingConfig {
  @Prop({ type: Types.ObjectId, ref: 'MappingSet', required: true, unique: true, index: true })
  mappingSetId!: Types.ObjectId;

  @Prop({ type: [EquityColumnSchema], default: [] })
  columns!: EquityColumn[];

  @Prop({ type: Map, of: String, default: () => new Map() })
  bsRowToEquityColumn!: Map<string, string>;

  @Prop({ type: [EquityMovementRowSchema], default: [] })
  movementRows!: EquityMovementRow[];

  @Prop({ type: [RegexPatternSchema], default: [] })
  rowPatterns!: RegexPattern[];

  @Prop({ type: [RegexPatternSchema], default: [] })
  columnPatterns!: RegexPattern[];

  @Prop({ type: String, default: '' })
  notes!: string;
}

export const EquityMappingConfigSchema = SchemaFactory.createForClass(EquityMappingConfig);

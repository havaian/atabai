import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RowMappingDocument = HydratedDocument<RowMapping>;

@Schema({ timestamps: true })
export class RowMapping {
  @Prop({ type: Types.ObjectId, ref: 'MappingSet', required: true, index: true })
  mappingSetId!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  nsbuRowCode!: string;

  @Prop({ type: [String], default: [] })
  nsbuCodes!: string[];

  @Prop({ type: String, default: '' })
  nsbuDescription!: string;

  @Prop({ type: String, required: true })
  ifrsClassification!: string;

  @Prop({ type: String, default: '' })
  section!: string;

  @Prop({ type: String, default: '' })
  subsection!: string;

  @Prop({ type: Boolean, default: false })
  isNegative!: boolean;

  @Prop({ type: Boolean, default: false })
  isCalculated!: boolean;

  // Mixed because legacy data has both string ("010 - 011") and structured
  // ({ op, operands }) forms.
  @Prop({ type: Object, default: null })
  formula!: string | { op: string; operands: unknown[] } | null;

  @Prop({ type: String, default: null })
  flowType!: string | null;

  @Prop({ type: Boolean, default: null })
  directMethod!: boolean | null;

  @Prop({ type: Boolean, default: null })
  netCalculation!: boolean | null;

  @Prop({ type: String, default: null })
  plSection!: string | null;

  @Prop({ type: String, default: '' })
  label!: string;

  @Prop({ type: Object, default: null })
  accountDetails!: unknown;

  @Prop({ type: String, default: '' })
  notes!: string;
}

export const RowMappingSchema = SchemaFactory.createForClass(RowMapping);

// One row code per set
RowMappingSchema.index({ mappingSetId: 1, nsbuRowCode: 1 }, { unique: true });

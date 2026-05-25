import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReportType = 'balance_sheet' | 'cash_flow' | 'profit_loss_form2' | 'equity';
export type MappingSetStatus = 'draft' | 'published' | 'archived';
export const REPORT_TYPES: ReportType[] = [
  'balance_sheet',
  'cash_flow',
  'profit_loss_form2',
  'equity',
];

export type MappingSetDocument = HydratedDocument<MappingSet>;

@Schema({ timestamps: true })
export class MappingSet {
  @Prop({ type: String, required: true, enum: REPORT_TYPES, index: true })
  reportType!: ReportType;

  @Prop({ type: Number, required: true, min: 1 })
  version!: number;

  @Prop({
    type: String,
    required: true,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true,
  })
  status!: MappingSetStatus;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  assignedUsers!: Types.ObjectId[];

  @Prop({ type: String, default: '' })
  label!: string;

  @Prop({ type: String, default: '' })
  notes!: string;

  @Prop({ type: Date, default: null })
  publishedAt!: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  publishedBy!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;
}

export const MappingSetSchema = SchemaFactory.createForClass(MappingSet);

MappingSetSchema.index({ reportType: 1, status: 1 });
MappingSetSchema.index({ reportType: 1, version: -1 });
MappingSetSchema.index({ reportType: 1, status: 1, assignedUsers: 1 });

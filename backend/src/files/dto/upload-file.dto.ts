import { IsIn, IsNotEmpty, IsString } from 'class-validator';

import { TEMPLATE_TYPES, type TemplateType } from '../../common/constants/template-types';

export class UploadFileDto {
  @IsString()
  @IsNotEmpty({ message: 'Template type is required' })
  @IsIn(TEMPLATE_TYPES, { message: 'Invalid template type' })
  template!: TemplateType;
}

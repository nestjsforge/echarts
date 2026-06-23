import { Inject } from '@nestjs/common';
import { ECHARTS_MODULE_OPTIONS } from '../constants/echarts.constants';

export const InjectEchartsOptions = (): ParameterDecorator =>
  Inject(ECHARTS_MODULE_OPTIONS);

import { applyDecorators, Type } from '@nestjs/common';

export const ApiSuccessResponseDecorator = <TModel extends Type<any>>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  model: TModel,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  description?: string,
) => {
  // This is a placeholder decorator for when @nestjs/swagger is not available
  // When you install @nestjs/swagger, replace with actual implementation
  return applyDecorators();
};

export const ApiPaginatedResponseDecorator = <TModel extends Type<any>>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  model: TModel,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  description?: string,
) => {
  // This is a placeholder decorator for when @nestjs/swagger is not available
  // When you install @nestjs/swagger, replace with actual implementation
  return applyDecorators();
};

export const ApiErrorResponseDecorator = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  status: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  description: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  errorCode: string,
) => {
  // This is a placeholder decorator for when @nestjs/swagger is not available
  // When you install @nestjs/swagger, replace with actual implementation
  return applyDecorators();
};

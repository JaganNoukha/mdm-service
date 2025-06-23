import { HttpException, HttpStatus } from '@nestjs/common';

export const formatErrorResponse = (error, statusCode) => {
  if (error.code === 11000) {
    throw new HttpException(
      { message: 'Duplicate key error' },
      HttpStatus.CONFLICT,
    );
  } else {
    throw new HttpException({ message: error.message }, statusCode);
  }
};

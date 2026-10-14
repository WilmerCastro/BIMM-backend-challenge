import { Catch } from '@nestjs/common';
import type { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { InvalidInputError } from '../common/errors/invalid-input.error.js';

@Catch(InvalidInputError)
export class InvalidInputFilter implements GqlExceptionFilter {
  catch(error: InvalidInputError) {
    return new GraphQLError(error.message, {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
}

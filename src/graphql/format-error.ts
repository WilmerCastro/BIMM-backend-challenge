import type { GraphQLFormattedError } from 'graphql';

const INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR';

export const createErrorFormatter =
  (hideInternalErrors: boolean) =>
  (formatted: GraphQLFormattedError): GraphQLFormattedError => {
    const code = formatted.extensions?.code ?? INTERNAL_SERVER_ERROR;
    if (!hideInternalErrors || code !== INTERNAL_SERVER_ERROR) return formatted;

    return {
      message: 'Internal server error',
      path: formatted.path,
      extensions: { code: INTERNAL_SERVER_ERROR },
    };
  };

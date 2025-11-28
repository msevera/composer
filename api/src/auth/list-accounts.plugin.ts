import { sessionMiddleware } from 'better-auth/api';
import { createAuthEndpoint } from 'better-auth/plugins';
import { BetterAuthPlugin } from 'better-auth/types';

export const listAccountsPlugin = () => {
  return {
    id: "list-accounts-plugin",
    endpoints: {
      listUserAccounts: createAuthEndpoint("/list-accounts", {
        method: "GET",
        use: [sessionMiddleware],
        metadata: {
          openapi: {
            operationId: "listUserAccounts",
            description: "List all accounts linked to the user",
            responses: {
              "200": {
                description: "Success",
                content: {
                  "application/json": {
                    schema: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: {
                            type: "string",
                          },
                          providerId: {
                            type: "string",
                          },
                          createdAt: {
                            type: "string",
                            format: "date-time",
                          },
                          updatedAt: {
                            type: "string",
                            format: "date-time",
                          },
                          accountId: {
                            type: "string",
                          },
                          userId: {
                            type: "string",
                          },
                          scopes: {
                            type: "array",
                            items: {
                              type: "string",
                            },
                          },
                        },
                        required: [
                          "id",
                          "providerId",
                          "createdAt",
                          "updatedAt",
                          "accountId",
                          "userId",
                          "scopes",
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }, async (c) => {
        const session = c.context.session;
        const accounts = await c.context.internalAdapter.findAccounts(
          session.user.id,
        );

        return c.json(
          accounts.map((a) => ({
            id: a.id,
            providerId: a.providerId,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
            accountId: a.accountId,
            userId: a.userId,
            scopes: a.scope?.split(",") || [],
            // @ts-ignore
            email: a?.email,
          })),
        );
      })
    }
  } satisfies BetterAuthPlugin
}
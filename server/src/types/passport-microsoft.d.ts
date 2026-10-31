declare module "passport-microsoft" {
  import { Strategy as PassportStrategy } from "passport";

  export type MicrosoftVerifyCallback = (
    accessToken: string,
    refreshToken: string,
    params: Record<string, unknown>,
    profile: {
      id?: string;
      displayName?: string;
      emails?: Array<{ value: string }>;
      _json?: {
        mail?: string | null;
        userPrincipalName?: string | null;
        id?: string;
      };
    },
    done: (error: unknown, user?: unknown, info?: unknown) => void,
  ) => void;

  export interface MicrosoftStrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    tenant?: string;
    scope?: string[] | string;
    addUPNAsEmail?: boolean;
    authorizationParams?: Record<string, string>;
  }

  export class Strategy extends PassportStrategy {
    constructor(
      options: MicrosoftStrategyOptions,
      verify: MicrosoftVerifyCallback,
    );
  }
}

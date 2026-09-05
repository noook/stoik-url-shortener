import { Command, CommandRunner, Option } from "nest-commander";
import consola from "consola";
import { ApiTokensService } from "../auth/api-tokens.service.js";

interface TokenCreateOptions {
  name: string;
}

/**
 * pnpm --filter api cli token:create --name "recruiter-demo"
 *
 * Runs inside Nest's DI container so it reuses ApiTokensService directly - no
 * duplicated data-access logic between the CLI and the HTTP layer (see plan §2.2
 * on why nest-commander was chosen over unjs's citty for this).
 */
@Command({ name: "token:create", description: "Issue a new API token (shown once, plaintext)" })
export class TokenCreateCommand extends CommandRunner {
  constructor(private readonly apiTokensService: ApiTokensService) {
    super();
  }

  async run(_inputs: string[], options: TokenCreateOptions): Promise<void> {
    if (!options.name) {
      consola.error("--name is required, e.g. --name \"recruiter-demo\"");
      process.exitCode = 1;
      return;
    }

    const { plaintext, name } = await this.apiTokensService.createToken(options.name);
    consola.success(`Token created for "${name}"`);
    consola.box(plaintext);
    consola.warn("This is shown once. Only its hash is stored - save it somewhere safe now.");
  }

  @Option({ flags: "-n, --name <name>", description: "Human-readable label for this token" })
  parseName(value: string): string {
    return value;
  }
}

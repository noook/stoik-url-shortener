import { Command, CommandRunner, Option } from "nest-commander";
import consola from "consola";
import { ApiTokensService } from "../auth/api-tokens.service.js";

interface TokenCreateOptions {
  name?: string;
}

/** yyyy-MM-dd-HHmm in local time, e.g. "2026-09-07-1432" - used as a readable default token name when --name is omitted. */
const defaultNameFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
function defaultTokenName(): string {
  const parts = Object.fromEntries(
    defaultNameFormatter.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );
  return `token-${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}`;
}

/**
 * pnpm token:create                    (root shortcut, defaults to a timestamped name)
 * pnpm token:create -n "recruiter-demo"
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
    const name = options.name || defaultTokenName();
    const { plaintext } = await this.apiTokensService.createToken(name);
    consola.success(`Token created for "${name}"`);
    consola.box(plaintext);
    consola.warn("This is shown once. Only its hash is stored - save it somewhere safe now.");
  }

  @Option({ flags: "-n, --name <name>", description: "Human-readable label for this token (default: a timestamp)" })
  parseName(value: string): string {
    return value;
  }
}

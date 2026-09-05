import { Command, CommandRunner, Option } from "nest-commander";
import consola from "consola";
import { DomainsService } from "../domains/domains.service.js";

interface DomainAddOptions {
  hostname: string;
  default?: boolean;
}

/**
 * pnpm --filter api cli domain:add --hostname go3.nook.sh [--default]
 *
 * Provisions a new row in `domains` so it can be picked as a short-link target
 * and used to resolve redirects by Host header. This is the app-level half of
 * adding a domain - see docs/adding-a-domain.md for the infra half (DNS/reverse
 * proxy) that has to happen alongside it.
 */
@Command({ name: "domain:add", description: "Register a new short-link domain" })
export class DomainAddCommand extends CommandRunner {
  constructor(private readonly domainsService: DomainsService) {
    super();
  }

  async run(_inputs: string[], options: DomainAddOptions): Promise<void> {
    if (!options.hostname) {
      consola.error("--hostname is required, e.g. --hostname go3.nook.sh");
      process.exitCode = 1;
      return;
    }

    const existing = await this.domainsService.findByHostname(options.hostname);
    if (existing) {
      consola.warn(`Domain "${options.hostname}" already exists (id: ${existing.id})`);
      return;
    }

    const domain = await this.domainsService.add(options.hostname, options.default ?? false);
    consola.success(`Domain registered: ${domain?.hostname} (id: ${domain?.id})`);
  }

  @Option({ flags: "-h, --hostname <hostname>", description: "Hostname to register, e.g. go3.nook.sh" })
  parseHostname(value: string): string {
    return value;
  }

  @Option({ flags: "-d, --default", description: "Mark this domain as the default" })
  parseDefault(): boolean {
    return true;
  }
}

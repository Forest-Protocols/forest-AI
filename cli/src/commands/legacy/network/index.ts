import { legacyCommand } from "..";

export const networkCommand = legacyCommand
  .command("network")
  .alias("net")
  .description("Forest Network specific commands");

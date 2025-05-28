import { program } from "@/program";

export const networkCommand = program
  .command("network")
  .alias("net")
  .description("Forest Network specific commands");

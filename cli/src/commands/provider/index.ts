import { program } from "@/program";

export const providerCommand = program
  .command("provider")
  .alias("prov")
  .description("Provider specific commands");

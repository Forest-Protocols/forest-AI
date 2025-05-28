import { program } from "@/program";

export const agreementCommand = program
  .command("agreement")
  .alias("agr")
  .description("Agreement specific commands");

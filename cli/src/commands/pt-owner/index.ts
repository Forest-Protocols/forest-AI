import { program } from "@/program";

export const ptOwnerCommand = program
  .command("pt-owner")
  .alias("pto")
  .description("Protocol Owner specific actions");

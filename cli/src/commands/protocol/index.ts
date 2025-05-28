import { program } from "@/program";

export const protocolCommand = program
  .command("protocol")
  .aliases(["pt", "prot"])
  .description("Protocol specific commands");

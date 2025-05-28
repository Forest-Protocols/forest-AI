import { program } from "@/program";

export const getCommand = program
  .command("get")
  .description(
    "Shows information about an entity such as Protocol, Network, Provider, Offer etc."
  );

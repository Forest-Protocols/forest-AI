import { config } from "@/config";

export const OPTIONS = {
  PT_ADDRESS: {
    FLAGS: "-p, --protocol <address>",
    DESCRIPTION: "Protocol address",
    OPTION_NAME: "protocol",
  },
  ACCOUNT: {
    /**
     * Loads the option value to the config
     */
    HANDLER: (value: string) => config.account.load(value, "option"),
    FLAGS: "-a, --account <file or private key>",
    DESCRIPTION:
      "Private key of the caller's wallet. It can be either the private key or a file path that contains the private key.",
    OPTION_NAME: "account",
  },
  AGREEMENT_ID: {
    FLAGS: "-i, --agreement-id <number>",
    DESCRIPTION: "ID of the Agreement",
    OPTION_NAME: "agreementId",
  },
  OFFER_ID: {
    FLAGS: "-o, --offer <number>",
    DESCRIPTION: "Offer ID",
    OPTION_NAME: "offer",
  },
};

# Forest Network CLI Tool

This is the official CLI tool to interact with the Forest Network.

## Quickstart

Install it via `npm`:

```sh
npm i -g @forest-protocols/cli
```

At the startup, forest CLI creates a default configuration file located at `$HOME/.forest/config.json` (if it doesn't already exist). The configuration default params are listed below:

| Name            | Default               | Possible Values                                                  | Description                                                                |
| --------------- | --------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| rpcHost         | `127.0.0.1:8545`      | An RPC host without protocol part (such as `http://` or `ws://`) | Defines the RPC host that will be using to communicate with the blockchain |
| chain           | `anvil`               | `anvil`, `optimism`, `optimism-sepolia`, `base`, `base-sepolia`                          | Defines which blockchain will be used                                      |
| account         | `undefined`           | Private key of an EOA                                            | Defines what account will be used for blockchain transactions              |
| registryAddress | as per SDK definition | An EVM compatible address                                        | Defines the address of the Forest Registry contract to be used             |
| slasherAddress  | as per SDK definition | An EVM compatible address                                        | Defines the address of the Forest Slasher contract to be used              |
| tokenAddress    | as per SDK definition | An EVM compatible address                                        | Defines the address of the Forest Token contract to be used                |
| usdcAddress     | as per SDK definition | An EVM compatible address                                        | Defines the address of the USDC Token contract to be used                  |

To change them, you can use the command below:

```sh
forest config set <config name> <config value>
```

Once you customize your configuration file, you can start using the forest CLI;

```sh
# Lists all of the providers registered in the protocol
forest get providers
```

To update the CLI to the newest version type:

```sh
npm update @forest-protocols/cli -g
```

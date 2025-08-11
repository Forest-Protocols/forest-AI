# Forest Protocol CLI Documentation

The Forest Protocol CLI is a command-line tool for interacting with the Forest Protocol ecosystem. It provides commands for managing the network, providers, agreements, validators, agreements and more.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Global Options](#global-options)
- [Commands](#commands)
  - [Network Commands](#network-commands)
  - [Get Commands](#get-commands)
  - [Provider Commands](#provider-commands)
  - [Agreement Commands](#agreement-commands)
  - [Wallet Commands](#wallet-commands)
  - [Token Commands](#token-commands)
  - [Validator Commands](#validator-commands)
  - [Register Commands](#register-commands)
  - [Slasher Commands](#slasher-commands)
  - [PT Owner Commands](#pt-owner-commands)
  - [API Commands](#api-commands)
  - [Pipe Commands](#pipe-commands)
- [Common Options](#common-options)
- [Examples](#examples)
  - [Football Predictions: Complete Tutorial (User)](#football-predictions-complete-tutorial-user)
  - [AI Chat Services: Using Generic LLM Protocol (User)](#ai-chat-services-using-generic-llm-protocol-user)
  - [AI Image Generation: Using Text-to-Image Protocol (User)](#ai-image-generation-using-text-to-image-protocol-user)
  - [Provider Workflow Example (Provider)](#provider-workflow-example-provider)
  - [Validator Workflow Example (Validator)](#validator-workflow-example-validator)
- [Error Handling](#error-handling)
- [Tips](#tips)
- [Support](#support)

## Installation

### Quickstart

Install or update the CLI globally via npm:

```bash
npm i @forest-protocols/cli@latest -g
```

## Configuration

> [!IMPORTANT]
> By default the CLI comes pre-configured with values as below. If you plan on using it for reading data no action is required. If you plan writing data (registering, entering agreements etc.) then it is required to set the `account`.

At startup, the Forest CLI creates a default configuration file located at `$HOME/.forest/config.json` (if it doesn't already exist). The configuration default parameters are listed below:

| Name                | Default                                   | Possible Values                          | Description                                                                 |
| ------------------- | ----------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| pipe                | `http`                                    | `http`, `xmtp`                          | Defines which protocol will be used to communicate with the Actors         |
| rpcHost             | `https://base-sepolia-rpc.publicnode.com` | An RPC host without protocol part        | Defines the RPC host that will be using to communicate with the blockchain |
| indexerAPI          | `https://indexer.forestai.io`             | URL of the indexer                       | Defines the endpoint that exposes an API with Forest data access           |
| chain               | `base-sepolia`                            | `anvil`, `optimism`, `optimism-sepolia`, `base`, `base-sepolia` | Defines which blockchain will be used                                      |
| account             | `undefined`                               | Private key of an EOA                    | Defines what account will be used for blockchain transactions              |
| env                 | `production`                              | `dev` or `production`                    | Defines which environment is going to be used (e.g for XMTP communication) |
| rateLimit           | `10`                                      | Positive integer                         | Defines the maximum number of RPC requests allowed per time window         |
| rateLimitTimeWindow | `2000` (2 seconds)                        | Positive integer (milliseconds)          | Defines the time window for RPC rate limiting in milliseconds              |
| registryAddress     | as per SDK definition                     | An EVM compatible address                | Defines the address of the Forest Registry contract to be used             |
| slasherAddress      | as per SDK definition                     | An EVM compatible address                | Defines the address of the Forest Slasher contract to be used              |
| tokenAddress        | as per SDK definition                     | An EVM compatible address                | Defines the address of the Forest Token contract to be used                |
| usdcAddress         | as per SDK definition                     | An EVM compatible address                | Defines the address of the USDC Token contract to be used                  |

### View Configuration

```bash
# View all configuration
forest config get

# View specific configuration
forest config get <config-name>
```

### Set Configuration

To change configuration values, use the command below:

```bash
forest config set <config-name> <config-value>
```

**Examples:**
```bash
# Set RPC host
forest config set rpcHost https://mainnet.infura.io/v3/YOUR-PROJECT-ID

# Set chain
forest config set chain base-sepolia

# Set account private key
forest config set account 0x1234567890abcdef...

# Set environment
forest config set env production
```

> [!CAUTION]
> **Security Warning**: Never share your private key or commit it to version control. Keep it secure and use environment variables or secure configuration files in production environments.

> [!TIP]
> If you are planning on interacting with the system beyond reading data, it is advised to set the `account` so that you don't have to append the private key to all commands that require it.

> [!TIP]
> Alternatively, if you already have a config file, you can force the CLI to use it (without setting all values individually using the `forest config set` command), by taking the approach described below.

### Using Different Configuration Files

By default, configurations are stored in `$HOME/.forest/config.json`. To use a different configuration file, you can set the `FOREST_CONFIG` environment variable to point to your custom file:

```bash
export FOREST_CONFIG=/home/user/forest-configs/john/config.json
forest config get  # Uses the configuration file specified above
```

> [!IMPORTANT]
> When using a custom configuration file, the CLI will also use the same directory for storing other data (such as API spec files). It's recommended to organize your configuration files in separate directories for better management and to avoid conflicts.

## Global Options

The CLI supports several global options that can be used with any command:

```bash
forest [options] <command>
```

### Global Options

- `-y, --yes` - Assumes that all questions will be answered with 'Yes'
- `-s, --short-address` - Makes all address outputs shorter
- `--rpc <rpc host>` - Uses the given RPC endpoint for blockchain communication, *overwrites value set in the config*
- `--chain <chain name>` - Uses the given blockchain (anvil, optimism-sepolia, optimism, base, base-sepolia), *overwrites value set in the config*
- `--registry <address>` - Uses the given address for Forest Registry smart contract, *overwrites value set in the config*
- `--token <address>` - Uses the given address for Forest Token smart contract, *overwrites value set in the config*
- `--slasher <address>` - Uses the given address for Forest Slasher smart contract, *overwrites value set in the config*
- `--usdc <address>` - Uses the given address for USDC smart contract, *overwrites value set in the config*

## Commands

### Network Commands

Network commands allow you to manage Forest Network settings and operations.

**Alias:** `net`

#### `forest network set` (Admin)

Updates the Network settings.

```bash
forest network set [options]
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `--in-pt-register-fee <amount>` - Updates the Actor registration fee in a Protocol
- `--actor-register-fee <amount>` - Updates the Actor registration fee in the Network
- `--burn-ratio <percentage>` - Updates the percentage of the burn ratio
- `--max-pt <count>` - Updates the maximum Protocol count
- `--pt-register-fee <amount>` - Updates the Protocol registration fee in the Network
- `--revenue-share <percentage>` - Updates the revenue share
- `--treasury <address>` - Updates the treasury address

**Example:**
```bash
forest network set --actor-register-fee 100 --burn-ratio 5 --account 0x123...
```

#### `forest network pause` (Admin)

Pauses the Network.

```bash
forest network pause -a <private-key>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*

#### `forest network unpause` (Admin)

Unpauses the Network.

```bash
forest network unpause -a <private-key>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*

#### `forest network close-epoch` (All)

Closes the current epoch.

```bash
forest network close-epoch -a <private-key>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*

#### `forest network emissions` (All)

Manages network emissions. The default view shows the split of emissions between Protocols. Use the subcommands (available using options) for more details on emissions within Protocols.

```bash
forest network emissions [options]
```

**Options:**
- `--protocol <ptAddress>` - Show all emissions for protocol owners, providers and validators of a specific protocol
- `--providers` - Show all emissions for providers of a specific protocol (requires `--protocol`)
- `--validators` - Show all emissions for validators of a specific protocol (requires `--protocol`)
- `--pto` - Show all emissions for protocol owners of a specific protocol (requires `--protocol`)
- `--granular-data <actorAddressOrId>` - Show granular validation details for a specific actor in a protocol (requires `--protocol`)
- `--save <output>` - Save the emissions to a file as CSV or JSON (if the output is given as .json)

**Examples:**

1. **View all protocol emissions (default):**
```bash
forest network emissions
```

2. **View emissions for a specific protocol:**
```bash
forest network emissions --protocol 0x123...
```

3. **View provider emissions for a specific protocol:**
```bash
forest network emissions --protocol 0x123... --providers
```

4. **View validator emissions for a specific protocol:**
```bash
forest network emissions --protocol 0x123... --validators
```

5. **View protocol owner emissions for a specific protocol:**
```bash
forest network emissions --protocol 0x123... --pto
```

6. **View granular data for a specific actor:**
```bash
forest network emissions --protocol 0x123... --granular-data 32
```

7. **Save emissions data to CSV file:**
```bash
forest network emissions --save emissions.csv
```

8. **Save emissions data to JSON file:**
```bash
forest network emissions --protocol 0x123... --providers --save data.json
```

### Get Commands

Get commands retrieve information about various entities in the Forest Protocol.

#### `forest get network` (All)

Retrieves Network settings and statistics.

```bash
forest get network
```

**Alias:** `net`

#### `forest get protocol` (All)

Retrieves Protocol information.

```bash
forest get protocol [addresses...]
```

**Aliases:** `pt`, `protocols`

**Arguments:**
- `[addresses...]` - Smart contract addresses of the Protocols. If not given shows all of them.

**Options:**
- `-d, --details` - Reads additional details from the Providers/Validators in the Protocols (default: true)
- `-c, --compact` - Limits the detail text outputs to 200 characters to save space in the screen

#### `forest get offer` (All)

Lists the registered Offers.

```bash
forest get offer [addresses...]
```

**Aliases:** `offers`, `off`

**Arguments:**
- `[addresses...]` - Lists Offers from the given Protocols

**Options:**
- `--details` - Reads additional details about the Offers from the Providers (default: true)
- `--status <active | inactive | all>` - Filters Offers by status (default: "active")
- `-c, --compact` - Limits the detail text outputs to 200 characters to save space in the screen

#### `forest get provider` (All)

Gets one or more Provider(s) information.

```bash
forest get provider [address or id...]
```

**Aliases:** `prov`, `provs`, `providers`

**Arguments:**
- `[address or id...]` - Owner wallet address or IDs of the Providers (if not provided, shows all providers)

#### `forest get validator` (All)

Gets one or more Validator(s) information.

```bash
forest get validator [address or id...]
```

**Aliases:** `val`, `vals`, `validators`

**Arguments:**
- `[address or id...]` - Owner wallet address or IDs of the Validators (if not provided, shows all validators)

#### `forest get pt-owner` (All)

Gets one or more Protocol Owner(s) information.

```bash
forest get pt-owner [address or id...]
```

**Aliases:** `pto`, `ptos`, `pt-owners`

**Arguments:**
- `[address or id...]` - Owner wallet address or IDs of the Protocol Owners (if not provided, shows all protocol owners)

### Provider Commands

Provider commands allow providers to manage their offers and operations.

**Alias:** `prov`

#### `forest provider register-offer` (Provider)

Registers an Offer into a Protocol.

```bash
forest provider register-offer [options]
```

**Required Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address
- `--details <file>` - Detailed information about the Offer
- `--fee <amount>` - Non-exponent per second price of the offer. 1 unit is approximately 2.60 USDC per month
- `--stock <amount>` - Stock amount of the offer

**Example:**
```bash
forest provider register-offer \
  -a 0x123... \
  -p 0x456... \
  --details offer-details.json \
  --fee 1000000 \
  --stock 10
```

#### `forest provider pause-offer` (Provider)

Pauses an active offer.

```bash
forest provider pause-offer -a <private-key> -p <protocol-address> -o <offer-id>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address
- `-o, --offer <number>` - Offer ID

#### `forest provider unpause-offer` (Provider)

Unpauses a paused offer.

```bash
forest provider unpause-offer -a <private-key> -p <protocol-address> -o <offer-id>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address
- `-o, --offer <number>` - Offer ID

#### `forest provider close-offer` (Provider)

Closes an offer.

```bash
forest provider close-offer -a <private-key> -p <protocol-address> -o <offer-id>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address
- `-o, --offer <number>` - Offer ID

#### `forest provider withdraw` (Provider)

Withdraws funds from an offer.

```bash
forest provider withdraw -a <private-key> -p <protocol-address> -o <offer-id>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address
- `-o, --offer <number>` - Offer ID

#### `forest provider register-in` (Provider)

Registers as a provider in a protocol.

```bash
forest provider register-in -a <private-key> -p <protocol-address>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address

#### `forest provider update` (Provider)

Updates provider information.

```bash
forest provider update -a <private-key> -p <protocol-address>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address

#### `forest provider topup-collateral` (Provider)

Adds collateral to provider account.

```bash
forest provider topup-collateral -a <private-key> -p <protocol-address>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address

#### `forest provider withdraw-collateral` (Provider)

Withdraws collateral from provider account.

```bash
forest provider withdraw-collateral -a <private-key> -p <protocol-address>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address

### Agreement Commands

Agreement commands allow users to manage their service agreements with providers.

#### `forest agreement enter` (All)

Enters into an Agreement with a Provider in the given Protocol and Offer.

```bash
forest agreement enter [options]
```

**Required Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address
- `-o, --offer <number>` - Offer ID

**Optional Options:**
- `--deposit <number>` - Amount of USDC for initial deposit (defaults to 2 months of fee)

**Example:**
```bash
forest agreement enter \
  -a 0x123... \
  -p 0x456... \
  -o 1 \
  --deposit 100
```

#### `forest agreement list` (All)

Lists all entered Agreements in the given Protocol.

```bash
forest agreement list [options]
```

**Alias:** `ls`

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address
- `-c, --closed` - Lists closed agreements

**Example:**
```bash
forest agreement list -a 0x123... -p 0x456...
```

#### `forest agreement details` (All)

Shows detailed information about a specific agreement.

```bash
forest agreement details -a <private-key> -p <protocol-address> -i <agreement-id>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address
- `-i, --agreement-id <number>` - Agreement ID

#### `forest agreement close` (All)

Closes an active agreement.

```bash
forest agreement close -a <private-key> -p <protocol-address> -i <agreement-id>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address
- `-i, --agreement-id <number>` - Agreement ID

#### `forest agreement topup` (All)

Adds funds to an agreement.

```bash
forest agreement topup -a <private-key> -p <protocol-address> -i <agreement-id>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address
- `-i, --agreement-id <number>` - Agreement ID

#### `forest agreement withdraw` (All)

Withdraws funds from an agreement.

```bash
forest agreement withdraw -a <private-key> -p <protocol-address> -i <agreement-id>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address
- `-i, --agreement-id <number>` - Agreement ID

### Wallet Commands

Wallet commands help you manage and view wallet information.

#### `forest wallet balance` (All)

Shows wallet balances for USDC, ETH, and FOREST tokens.

```bash
forest wallet balance [address]
```

**Arguments:**
- `[address]` - Wallet address (optional, uses account if not provided)

**Example:**
```bash
forest wallet balance 0x123...
```

#### `forest wallet allowance` (All)

Shows token allowances for a wallet.

```bash
forest wallet allowance [address]
```

**Arguments:**
- `[address]` - Wallet address (optional, uses account if not provided)

### Token Commands

Token commands allow you to manage Forest tokens.

#### `forest token pause` (Admin)

Pauses token operations.

```bash
forest token pause -a <private-key>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*

#### `forest token unpause` (Admin)

Unpauses token operations.

```bash
forest token unpause -a <private-key>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*

### Validator Commands

Validator commands allow validators to manage their operations and commitments.

#### `forest validator commit` (Validator)

Commits Provider scores for a given Protocol.

```bash
forest validator commit [options]
```

**Required Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address
- `--scores <JSON or file>` - JSON file containing Provider scores

**Optional Options:**
- `--validator-address <address>` - Address of the Validator (defaults to account address)

**Example:**
```bash
forest validator commit \
  -a 0x123... \
  -p 0x456... \
  --scores scores.json
```

#### `forest validator reveal` (Validator)

Reveals committed Provider scores.

```bash
forest validator reveal [options]
```

**Required Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address
- `--scores <JSON or file>` - JSON file containing Provider scores

#### `forest validator register-in` (Validator)

Registers as a validator in a protocol.

```bash
forest validator register-in -a <private-key> -p <protocol-address>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address

#### `forest validator update` (Validator)

Updates validator information.

```bash
forest validator update -a <private-key> -p <protocol-address>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address

#### `forest validator topup-collateral` (Validator)

Adds collateral to validator account.

```bash
forest validator topup-collateral -a <private-key> -p <protocol-address>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address

#### `forest validator withdraw-collateral` (Validator)

Withdraws collateral from validator account.

```bash
forest validator withdraw-collateral -a <private-key> -p <protocol-address>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address

### Register Commands

Register commands allow entities to register in the Forest Protocol.

#### `forest register provider` (All)

Registers as a provider.

```bash
forest register provider -a <private-key>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*

#### `forest register validator` (All)

Registers as a validator.

```bash
forest register validator -a <private-key>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*

#### `forest register pt-owner` (All)

Registers as a protocol owner.

```bash
forest register pt-owner -a <private-key>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*

### Slasher Commands

Slasher commands allow you to manage the slashing mechanism.

#### `forest slasher pause` (Admin)

Pauses slasher operations.

```bash
forest slasher pause -a <private-key>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*

#### `forest slasher unpause` (Admin)

Unpauses slasher operations.

```bash
forest slasher unpause -a <private-key>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*

### PT Owner Commands

Protocol Token Owner commands allow protocol owners to manage their protocols.

#### `forest pt-owner update` (PTO)

Updates protocol owner information.

```bash
forest pt-owner update -a <private-key> -p <protocol-address>
```

**Options:**
- `-a, --account <file or private key>` - Private key of the caller's wallet, *if missing taken from config*
- `-p, --protocol <address>` - Protocol address

### API Commands

API commands provide programmatic access to Forest Protocol data.

#### `forest api import` (All)

Imports data via the API.

```bash
forest api import [options]
```

### Pipe Commands

Pipe commands handle communication channels.

#### `forest pipe` (All)

Manages communication pipes.

```bash
forest pipe [options]
```

## Common Options

Many commands share common options:

- `-a, --account <file or private key>` - Private key of the caller's wallet
- `-p, --protocol <address>` - Protocol address
- `-o, --offer <number>` - Offer ID
- `-i, --agreement-id <number>` - Agreement ID
- `-P, --pipe <type>` - Pipe type (xmtp or http)
- `-E, --endpoint <base url>` - Operator endpoint for HTTP Pipe

## Examples

### Football Predictions: Complete Tutorial (User)

> [!WARNING]
> The protocol and provider addresses here are for Base Sepolia testnet deployment as of 01.08.2025. These addresses may change over time. Check for up-to-date ones if these do not work.

Follow this step-by-step workflow to get started with the Forest Protocol:

1. **Install the latest CLI:**
```bash
npm i @forest-protocols/cli@latest -g
```

2. **Set up your account (prefunded test account):**
```bash
forest config set account 0x69...368b
```

3. **See available Protocols with details:**
```bash
forest get protocol
```

4. **See latest emissions to Protocols:**
```bash
forest network emissions
```

5. **See latest emissions within the Football Predictions Protocol:**
```bash
forest network emissions --protocol 0x2c21f0c457088814a3696cd7b238cb18b2e69e73 --providers
```

6. **Browse offers:**
```bash
forest get offer 0x2c21f0c457088814a3696cd7b238cb18b2e69e73
```

7. **Enter an agreement with the top Provider from Football Predictions:**
```bash
forest agreement enter -o 0 -p 0x2c21f0c457088814a3696cd7b238cb18b2e69e73
```

8. **Import OpenAPI specs for this Protocol to be able to use it from the CLI:**
```bash
forest api import 0x7e04F0a076E6c8986A7e083e2a215ea1Ac003385
```

9. **Make a prediction using your purchased service:**
```bash
# Update the query to use your agreement id from step 7 output
# NOTE: Unix-based syntax - Windows users may need to adjust the --body.challenges object
forest api football-scores predict-fixture-results \
  --operator 0x7e04F0a076E6c8986A7e083e2a215ea1Ac003385 \
  --provider-id 35 \
  --body.id 4361 \
  --body.pt 0x2c21f0c457088814a3696cd7b238cb18b2e69e73 \
  --body.challenges '[{"challengeId":"21f04f95-6520-4b55-a82a-b7a7416d32f1","homeTeam":"Botafogo","awayTeam":"Cruzeiro","venue":"Estádio Nilton Santos","league":"Serie A","fixtureId":19387075,"kickoffTime":"2025-08-03T19:00:00Z","challengePhaseMinutes":2160,"targetMarket":"1X2","phaseIdentifier":"T36H","difficulty":0.980588461890651}]'
```

### AI Chat Services: Using Generic LLM Protocol (User)

> [!WARNING]
> The protocol and provider addresses here are for Base Sepolia testnet deployment as of 01.08.2025. These addresses may change over time. Check for up-to-date ones if these do not work.

Follow these steps to get an AI chat service agreement and use it:

1. **Enter an agreement with a Provider from Generic LLM:**
```bash
forest agreement enter -o 3 -p 0x2cf3a88a17fa5c5601de77b44f19a02e572c03af
```

2. **Import OpenAPI specs for this Protocol:**
```bash
forest api import 0x683cfa58c67b0699e5885dd6b148f2d5a1801f57
```

3. **Make a chat completion request:**
```bash
# Update the query to use your agreement id from step 1 output
# NOTE: Unix-based syntax - Windows users may need to adjust the --body.messages object
forest api gllm chat/completions \
  --provider-id 8 \
  --body.id <agreement_id_here> \
  --body.pt 0x2cf3a88a17fa5c5601de77b44f19a02e572c03af \
  --operator 0x683cfa58c67b0699e5885dd6b148f2d5a1801f57 \
  --body.messages '[{"role": "user", "content": "Hello, how are you?"}]'
```

### AI Image Generation: Using Text-to-Image Protocol (User)

> [!WARNING]
> The protocol and provider addresses here are for Base Sepolia testnet deployment as of 01.08.2025. These addresses may change over time. Check for up-to-date ones if these do not work.

Follow these steps to get an AI image generation service agreement and use it:

1. **Enter an agreement with a Provider from Imagify:**
```bash
forest agreement enter -o 1 -p 0x8ad79320ccf0e6420ffd4371035590e48a99ed94
```

2. **Import OpenAPI specs for this Protocol:**
```bash
forest api import 0x6afc73ddd03157b4bccdd5fb3cb3b48ed31ee977
```

3. **Generate an image using your purchased service:**
```bash
# Update the query to use your agreement id from step 1 output
# NOTE: Unix-based syntax - Windows users may need to adjust the --body object
forest api text-to-image generate \
  --provider-id 15 \
  --body.id <agreement_id_here> \
  --body.pt 0x8ad79320ccf0e6420ffd4371035590e48a99ed94 \
  --operator 0x6afc73ddd03157b4bccdd5fb3cb3b48ed31ee977 \
  --body.prompt "A dog ontop of Empire State Building waiting for love"
```

### Provider Workflow Example (Provider)

> [!IMPORTANT]
> **Always check your wallet balance before starting any provider workflow to ensure you have sufficient funds for registration fees and collateral.**

1. **Check your wallet balance:**
```bash
forest wallet balance 0x123...
```

2. **Register as a provider:**
```bash
forest register provider -a 0x123...
```

3. **Register in a protocol:**
```bash
forest provider register-in -a 0x123... -p 0x456...
```

4. **Create an offer:**
```bash
forest provider register-offer \
  -a 0x123... \
  -p 0x456... \
  --details my-offer.json \
  --fee 1000000 \
  --stock 10
```

5. **Enter an agreement:**
```bash
forest agreement enter \
  -a 0x789... \
  -p 0x456... \
  -o 1
```

6. **List your agreements:**
```bash
forest agreement list -a 0x789... -p 0x456...
```

### Validator Workflow Example (Validator)

1. **Register as a validator:**
```bash
forest register validator -a 0x123...
```

2. **Register in a protocol:**
```bash
forest validator register-in -a 0x123... -p 0x456...
```

3. **Commit scores:**
```bash
forest validator commit \
  -a 0x123... \
  -p 0x456... \
  --scores scores.json
```

### Important Notes

- **Agreement IDs**: Each `forest agreement enter` command will output an agreement ID that you need to use in subsequent API calls
- **Windows Users**: You may need to adjust JSON objects in `--body` parameters to work with Windows command line syntax
- **Provider IDs**: Each protocol has different provider IDs - check the offers to see available providers

## Error Handling

The CLI provides detailed error messages and validation. Common error scenarios:

- **Invalid private key:** Ensure your private key is correct and properly formatted
- **Insufficient funds:** Check your wallet balance before making transactions
- **Network issues:** Verify your RPC endpoint and network connection
- **Permission errors:** Ensure you have the correct permissions for the operation

## Tips

1. **Use the `-y` flag** to skip confirmation prompts in automated scripts
2. **Use the `-s` flag** for shorter address outputs in logs
3. **Set up configuration** to avoid repeating common options
4. **Use ENS names** instead of addresses where possible for better readability
5. **Check help** for any command with `--help` flag
6. **Keep your CLI updated** with `npm i @forest-protocols/cli@latest -g`

## Support

For additional support and documentation, visit the Forest Protocol documentation or contact the development team.

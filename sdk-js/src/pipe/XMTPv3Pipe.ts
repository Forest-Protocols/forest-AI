import {
  Address,
  hashMessage,
  Hex,
  hexToBytes,
  PrivateKeyAccount,
  recoverAddress,
} from "viem";
import {
  AbstractPipe,
  PipeRouteHandler,
  PipeRequest,
  PipeResponse,
  PipeMethod,
  PipeResponseCode,
  PipeSendRequest,
  PipeRouteHandlerResponse,
} from "./AbstractPipe";
import { privateKeyToAccount } from "viem/accounts";
import { v7 as uuidv7 } from "uuid";
import { PipeError, TimeoutError } from "@/errors";
import { pathToRegexp } from "path-to-regexp";
import {
  Client,
  Conversation,
  IdentifierKind,
  Signer,
  XmtpEnv,
} from "@xmtp/node-sdk";
import { getRandomValues } from "crypto";
import { rmSync, statSync } from "fs";
import { MaybePromise } from "@/types";
import { tmpdir } from "os";
import { join } from "path";
import { tryReadJson as tryParseJson } from "@/utils/json";

type Listener = (...args: any[]) => MaybePromise<any>;
type EventType = "close" | "response";

/**
 * Pipe implementation on top of XMTP v3.
 * For more info: https://xmtp.org/
 */
export class XMTPv3Pipe extends AbstractPipe {
  private encryptionKey: Uint8Array<ArrayBuffer>;
  private xmtpClient: Client | null = null;
  private account: PrivateKeyAccount;
  private signal?: AbortSignal;
  private dbPath?: string;
  private signer: Signer;
  private persistentLocalDb = false;
  private isClosed = false;
  private eventListeners: Map<EventType, Listener[]> = new Map();
  private revokeOtherInstallations;
  private revokeInstallation;

  constructor(
    privateKey: Hex,
    options?: {
      /**
       * Abort signal
       */
      signal?: AbortSignal;

      /**
       * Custom encryption key for XMTP local database. If it is given
       * then the client uses that key for the local database encryption and doesn't delete
       * database files at initialization and closing steps. If it is `undefined`
       * then generates a random key for the current session but in every creation
       * of Pipe, it'll delete the old database files.
       */
      encryptionKey?: string;

      /**
       * Custom path for XMTP local database
       * @default "OS default tmp directory"
       */
      dbPath?: string;

      /**
       * Revokes all other installations before initialization of the client
       * @default false
       */
      revokeOtherInstallations?: boolean;

      /**
       * Revokes this installation when the `close()` is called
       * @default false
       */
      revokeInstallation?: boolean;
    }
  ) {
    super();
    this.account = privateKeyToAccount(privateKey);
    this.signal = options?.signal;
    this.dbPath = options?.dbPath;
    this.revokeInstallation = options?.revokeInstallation;
    this.revokeOtherInstallations =
      options?.revokeOtherInstallations !== undefined
        ? options?.revokeOtherInstallations
        : false;

    if (options?.encryptionKey !== undefined) {
      this.encryptionKey = this.generateEncryptionKey(options.encryptionKey);

      // If the encryption key is set, that means we want to use a persistent local database so don't delete it.
      this.persistentLocalDb = true;
    } else {
      // Use a randomly generated key for the database
      this.encryptionKey = getRandomValues(new Uint8Array(32)); // IDEA: What if we use first 32 character of private key? Such as: this.generateEncryptionKey(privateKey);
    }

    this.signer = {
      type: "EOA",
      getIdentifier: async () => ({
        identifier: this.account.address,
        identifierKind: IdentifierKind.Ethereum,
      }),
      signMessage: async (message: string) => {
        return hexToBytes(await this.account.signMessage({ message }));
      },
    };
  }

  /**
   * Generates 32 byte fixed length Uint8Array for encryption key usage
   */
  private generateEncryptionKey(input: string) {
    // Be sure input is longer than 32 character
    if (input.length < 32) {
      input = input.repeat(32 % input.length);
    }

    const encoder = new TextEncoder();
    const encoded = encoder.encode(input);
    const fixedLengthArray = new Uint8Array(32);
    fixedLengthArray.set(encoded.slice(0, 32));

    return fixedLengthArray;
  }

  /**
   * Add event listener
   */
  private addListener(event: EventType, listener: Listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  private removeListener(event: EventType, listener: Listener) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      this.eventListeners.set(
        event,
        listeners.filter((l) => l !== listener)
      );
    }
  }

  /**
   * Emit event listeners
   */
  private emitListener(event: EventType, ...args: any[]) {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach((l) => l(...args));
  }

  /**
   * Deletes the local databases that created by XMTP SDK
   * if `persistentLocalDatabase` is not enabled.
   */
  private cleanLocalDatabase() {
    if (this.persistentLocalDb) {
      return;
    }

    const paths = [
      this.dbPath,
      `${this.dbPath}-shm`,
      `${this.dbPath}-wal`,
      `${this.dbPath}.sqlcipher_salt`,
    ];

    for (const path of paths) {
      if (path && statSync(path, { throwIfNoEntry: false })?.isFile()) {
        rmSync(path, { force: true, recursive: true });
      }
    }
  }

  override async init(env: XmtpEnv) {
    const address = (await this.signer.getIdentifier()).identifier;

    // If the `dbPath` is not given, then use a default one
    this.dbPath ??= join(
      tmpdir(),
      `xmtp-${env}-${address.toLowerCase()}-${
        Date.now() + Math.floor(Math.random() * 100)
      }.db`
    );
    this.cleanLocalDatabase();

    this.xmtpClient = await this.checkAbortAndClose(() =>
      Client.create(this.signer, {
        dbEncryptionKey: this.encryptionKey,
        env: env,
        dbPath: this.dbPath,
      })
    );

    if (this.revokeOtherInstallations) {
      const state = await this.xmtpClient.preferences.inboxState();

      if (state.installations.length > 1) {
        await this.xmtpClient.revokeAllOtherInstallations();
      }
    }

    // Start listener process (for listening requests and responses)
    this.listen().catch((err) => {
      console.error(`XMTP v3 error while listening:`, err);
    });
  }

  /**
   * Finds inboxId for the given EOA address
   */
  private async addressToInboxId(address: Address | string) {
    const targetInboxId = await this.checkAbortAndClose(() =>
      this.xmtpClient!.getInboxIdByIdentifier({
        identifierKind: IdentifierKind.Ethereum,
        identifier: address,
      })
    );

    if (targetInboxId === null) {
      throw new PipeError(PipeResponseCode.BAD_REQUEST, {
        message: "Target is not available",
      });
    }

    return targetInboxId;
  }

  /**
   * Finds or creates a new DM for the given inbox ID
   */
  private async findOrCreateDm(peerInboxId: string) {
    const dm = this.xmtpClient!.conversations.getDmByInboxId(peerInboxId);

    // Use existing DM there is
    if (dm !== undefined) {
      return dm;
    }

    /**
     * NOTE: Since XMTP stores all of the messages in the network,
     * creation of a new DM may take too much time if there are too many
     * messages within that DM. Currently we don't have a solution for that.
     */
    const newDm = await this.checkAbortAndClose(() =>
      this.xmtpClient!.conversations.newDm(peerInboxId)
    );

    return newDm;
  }

  /**
   * Checks if the abort signal is fired before executing an async function
   */
  private async checkAbortAndClose<T, K>(
    fn: () => MaybePromise<T>,
    onAborted?: () => MaybePromise<K>
  ): Promise<T> {
    if (this.isClosed) {
      throw new PipeError(PipeResponseCode.BAD_REQUEST, {
        message: "Connection is closed",
      });
    }

    if (this.signal?.aborted) {
      await onAborted?.();
      this.signal?.throwIfAborted();
    }

    return await fn();
  }

  async send(to: string, req: PipeSendRequest): Promise<PipeResponse> {
    this.checkInit();

    const peerInboxId = await this.addressToInboxId(to);
    const dm = await this.findOrCreateDm(peerInboxId);
    const requestId = uuidv7();

    return await this.checkAbortAndClose(
      () =>
        new Promise<PipeResponse>((res, rej) => {
          const clear = () => {
            this.removeListener("response", responseHandler);
            this.removeListener("close", abortAndCloseHandler);
            this.signal?.removeEventListener("abort", abortAndCloseHandler);
            clearTimeout(timeout);
          };

          const abortAndCloseHandler = () => {
            clear();

            if (this.isClosed) {
              return rej(
                new PipeError(PipeResponseCode.INTERNAL_SERVER_ERROR, {
                  message: "Connection closed before receiving the response",
                })
              );
            }

            if (this.signal?.aborted) {
              return rej(this.signal.reason);
            }
          };

          const timeout = setTimeout(() => {
            clear();
            rej(new TimeoutError("Pipe request"));
          }, req.timeout || 30_000);

          const responseHandler = (response: PipeResponse | undefined) => {
            // If the response is undefined that means the listener has stopped
            if (response === undefined) {
              return abortAndCloseHandler();
            }

            if (response.id !== requestId) {
              return;
            }

            clear();
            res(response);
          };

          this.addListener("response", responseHandler);
          this.addListener("close", abortAndCloseHandler);
          this.signal?.addEventListener("abort", abortAndCloseHandler);

          const errorHandler = (e: unknown) => {
            clear();
            rej(e);
          };

          // Sign request ID with the private key
          this.account
            .signMessage({
              message: requestId,
            })
            .then((signature) => {
              const hash = hashMessage(requestId);
              this.sendMessage(dm, {
                ...req,

                id: requestId,
                requester: this.account.address,
                headers: {
                  ...req.headers,

                  // Inject signature and hash of the request id into the headers
                  "X-Signature": signature,
                  "X-Signature-Hash": hash,
                },
              } as PipeRequest).catch(errorHandler);
            })
            .catch(errorHandler);
        })
    );
  }

  route(method: PipeMethod, path: string, handler: PipeRouteHandler): void {
    const route = this.routes[path];

    if (!route) {
      this.routes[path] = {
        [method]: handler,
      };
      return;
    }

    this.routes[path][method] = handler;
  }

  /**
   * Fetches the next message from the given stream and checks abort signal.
   */
  private async getNextFromStream(stream: ReturnType<Conversation["stream"]>) {
    return await this.checkAbortAndClose(
      async () => (await stream.next())?.value,
      async () => await stream.return(undefined)
    );
  }

  async close() {
    this.emitListener("close");

    if (this.revokeInstallation === true && this.xmtpClient) {
      const inboxState = await this.xmtpClient.preferences.inboxState();

      if (inboxState.installations.length > 1) {
        const installationId = this.xmtpClient.installationId;
        const installation = inboxState.installations.find(
          (i) => i.id == installationId
        );

        if (installation) {
          await this.xmtpClient.revokeInstallations([installation.bytes]);
        }
      }
    }

    this.cleanLocalDatabase();
  }

  private async sendMessage(to: string | Conversation, content: unknown) {
    this.checkInit();

    let dm: Conversation;

    if (typeof to === "string") {
      const inboxId = await this.addressToInboxId(to);
      dm = await this.findOrCreateDm(inboxId);
    } else {
      dm = to;
    }

    return await this.checkAbortAndClose(() =>
      dm.send(JSON.stringify(content))
    );
  }

  private async processRequest(senderAddress: string, req: PipeRequest) {
    // This might be a response (if this Pipe is being in use for sending and receiving messages)
    // So no need to to anything
    if (!req.path || !req.id || !req.method) return;

    if (!req.path.startsWith("/")) {
      req.path = `/${req.path}`;
    }

    // A dummy protocol and domain to parse path and query params.
    const url = new URL(`forest://protocols.io${req.path}`);

    // Parse query params
    req.params = {
      ...(req.params || {}),
      ...url.searchParams,
    };

    // Extract the pure path
    req.path = url.pathname;

    // Get signature to verify the sender address
    const signature = req.headers?.["X-Signature"] as Address | undefined;
    const signatureHash = req.headers?.["X-Signature-Hash"] as
      | Address
      | undefined;

    // Default response if the route handler is not found
    let response: PipeRouteHandlerResponse = {
      code: PipeResponseCode.NOT_FOUND,
      body: { message: `${req.method} ${req.path} is not found` },
    };

    try {
      if (signature === undefined || signatureHash === undefined) {
        throw new PipeError(PipeResponseCode.NOT_AUTHORIZED, {
          message: "Request doesn't include a signature",
        });
      } else {
        let recoveredAddress = "";
        try {
          recoveredAddress = await recoverAddress({
            hash: signatureHash,
            signature,
          });
        } catch (err) {
          console.error(
            "XMTP v3 error during the signature verification:",
            err
          );

          // Change it to something else so the next `throw` statement will be triggered
          recoveredAddress = "";
        }

        if (recoveredAddress !== req.requester) {
          throw new PipeError(PipeResponseCode.NOT_AUTHORIZED, {
            message: "Request has an invalid signature",
          });
        }
      }

      // Search for the requested path
      for (const [path, handlers] of Object.entries(this.routes)) {
        const { regexp, keys } = pathToRegexp(path);
        const result = regexp.exec(req.path);
        const routeHandler = handlers[req.method];

        // Path is not matched, keep looking
        if (result === null) {
          continue;
        }

        // Handler not found for the given method
        if (!routeHandler) {
          break;
        }

        // Place path params
        req.pathParams = {};

        for (let i = 0; i < keys.length; i++) {
          const key = keys[i].name;
          const value = result[i + 1]; // Skip first full matched string
          req.pathParams[key] = value;
        }

        response = (await this.checkAbortAndClose(() =>
          routeHandler({
            ...req,
            requester: senderAddress,
          })
        )) || {
          // Default response object if the route handler didn't provide one
          code: PipeResponseCode.OK,
        };

        // Route handler found, no need to continue
        break;
      }
    } catch (err) {
      if (err instanceof PipeError) {
        response = {
          code: err.code as PipeResponseCode,
          body: err.meta.body || { message: "Internal server error" },
        };
      } else {
        response = {
          code: PipeResponseCode.INTERNAL_SERVER_ERROR,
          body: { message: "Internal server error" },
        };
        console.error(
          `XMTP v3 error in route handler: ${req.method} ${req.path}:`,
          err
        );
      }
    }

    await this.sendMessage(senderAddress, {
      ...response,
      id: req.id, // Use the same ID with the request
    });
  }

  private async listen() {
    this.checkInit();

    const stream = await this.checkAbortAndClose(() =>
      this.xmtpClient!.conversations.streamAllDmMessages()
    );
    const abortAndCloseHandler = () => stream.return(undefined);
    const clear = () => {
      this.removeListener("close", abortAndCloseHandler);
      this.signal?.removeEventListener("abort", abortAndCloseHandler);
    };

    this.signal?.addEventListener("abort", abortAndCloseHandler);
    this.addListener("close", abortAndCloseHandler);

    while (!this.isClosed && !this.signal?.aborted) {
      try {
        const message = await this.getNextFromStream(stream);
        if (message === undefined) {
          continue;
        }

        // Ignore messages of this client
        if (message.senderInboxId === this.xmtpClient!.inboxId) {
          continue;
        }

        // This message might be either request or response
        const reqRes = tryParseJson<PipeRequest | PipeResponse>(
          `${message.content}`
        );

        // It is not in JSON format so just ignore it
        if (reqRes === undefined) {
          continue;
        }

        if ("requester" in reqRes) {
          // Start async function in order to process the request
          this.processRequest(reqRes.requester, reqRes).catch((err) => {
            console.error(
              "XMTPv3 error while processing request: ",
              err?.message || err?.stack || err
            );
          });
        } else if ("id" in reqRes && "code" in reqRes) {
          // Notify listeners in case if there is any "send" call
          this.emitListener("response", reqRes);
        }
      } catch (err) {
        // Abort signal received, just finish the listener function
        if (this.signal?.aborted) {
          // Notify response waiters with an undefined value
          this.emitListener("response", undefined);
          break;
        }
        console.error(`XMTP v3 error while listening:`, err);
      }
    }

    clear();
  }

  private checkInit() {
    if (!this.xmtpClient) {
      throw new Error(
        "Pipe client (XMTPv3) has not been initialized (call init() before start to use it)"
      );
    }
  }
}

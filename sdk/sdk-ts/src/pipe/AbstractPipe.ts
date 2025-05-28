import { MaybePromise } from "@/types";

export enum PipeMethod {
  GET = "GET",
  POST = "POST",
  DELETE = "DELETE",
  PUT = "PUT",
  PATCH = "PATCH",
}

/**
 * Pre-defined response code for Pipe Responses
 */
export enum PipeResponseCode {
  OK = 200,
  INTERNAL_SERVER_ERROR = 500,
  NOT_FOUND = 404,
  NOT_AUTHORIZED = 401,
  BAD_REQUEST = 400,
}

export type PipeRequest = {
  id: string;
  method: PipeMethod;
  path: string;

  /**
   * Sender of the request.
   */
  requester: string;
  body?: any;
  headers?: Record<string, string>;

  /**
   * Query params.
   */
  params?: { [key: string]: any };

  pathParams?: { [key: string]: any };
};

export type PipeResponse = {
  id: string;
  code: PipeResponseCode;
  body?: any;
};

export type PipeSendRequest = {
  method: PipeMethod;
  path: string;
  body?: any;
  timeout?: number;
  headers?: Record<string, string>;

  /**
   * Query params. Also can be included inside the path.
   */
  params?: { [key: string]: any };
};

export type PipeRouteHandlerResponse = {
  code: PipeResponseCode;
  body?: any;
};

/**
 * Route handler function of a pipe route
 */
export type PipeRouteHandler = (
  req: PipeRequest
) => MaybePromise<PipeRouteHandlerResponse | void>;

/**
 * Pipe is a very simple abstraction layer for HTTP like
 * request-response style communication between two endpoints.
 */
export abstract class AbstractPipe {
  protected routes: {
    [path: string]: {
      [pipeMethod: string]: PipeRouteHandler;
    };
  } = {};

  /**
   * Initializes the Pipe.
   * @param params Additional parameters for the initialization (its type depends on the implementation)
   */
  abstract init(params?: any): Promise<any>;

  /**
   * Sends a request through a pipe to the target.
   * @param to Target address/identifier/url etc. (depends on the implementation)
   * @param req Content of the request.
   */
  abstract send(to: string, req: PipeSendRequest): Promise<PipeResponse>;

  /**
   * Closes the pipe.
   */
  abstract close(): Promise<any>;

  /**
   * Setup a handler for a particular path. This handler will be
   * executed whenever a request has been received for the
   * `path` & `method` pair.
   * @param method Pipe request method
   * @param path
   * @param handler
   */
  abstract route(
    method: PipeMethod,
    path: string,
    handler: PipeRouteHandler
  ): void;
}

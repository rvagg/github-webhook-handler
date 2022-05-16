///<reference types="node" />

import { IncomingMessage, ServerResponse } from "http";
import { EventEmitter } from "events";

export interface CreateHandlerOptions {
    path: string;
    secret: string;
    events?: string | string[];
}

export interface handler extends EventEmitter {
    (req: IncomingMessage, res: ServerResponse, callback: (err: Error) => void): void;
}

declare function createHandler(options: CreateHandlerOptions|CreateHandlerOptions[]): handler;

export default createHandler;

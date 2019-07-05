///<reference types="node" />

import { IncomingMessage, ServerResponse } from "http";
import { EventEmitter } from "events";

interface CreateHandlerOptions {
    path: string;
    secret: string;
    events?: string | string[];
}

interface handler extends EventEmitter {
    (req: IncomingMessage, res: ServerResponse, callback: (err: Error) => void): void;
}

declare function createHandler(options: CreateHandlerOptions|CreateHandlerOptions[]): handler;

export = createHandler;
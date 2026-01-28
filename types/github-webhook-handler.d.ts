export default create;
export type CreateHandlerOptions = {
    path: string;
    secret: string;
    events?: string | string[] | undefined;
};
export type WebhookEvent = {
    /**
     * - The event type (e.g. 'push', 'issues')
     */
    event: string;
    /**
     * - The delivery ID from X-Github-Delivery header
     */
    id: string;
    /**
     * - The parsed JSON payload
     */
    payload: any;
    /**
     * - The request protocol
     */
    protocol?: string | undefined;
    /**
     * - The request host header
     */
    host?: string | undefined;
    /**
     * - The request URL
     */
    url: string;
    /**
     * - The matched handler path
     */
    path: string;
};
/**
 * @param {CreateHandlerOptions | CreateHandlerOptions[]} initOptions
 * @returns {EventEmitter & {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, callback: (err?: Error) => void): void, sign(data: string | Buffer): string, verify(signature: string, data: string | Buffer): boolean}}
 */
declare function create(initOptions: CreateHandlerOptions | CreateHandlerOptions[]): EventEmitter & {
    (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse, callback: (err?: Error) => void): void;
    sign(data: string | Buffer): string;
    verify(signature: string, data: string | Buffer): boolean;
};
import { EventEmitter } from 'node:events';
//# sourceMappingURL=github-webhook-handler.d.ts.map
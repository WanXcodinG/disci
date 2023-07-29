// types for events
import type { TypedEmitter } from "./utils/TypedEmitter";
import { EventEmitter } from "events";

import {
	APIInteraction,
	APIInteractionResponse,
	InteractionResponseType,
	InteractionType,
} from "discord-api-types/v10";
import {
	HandlerOptions,
	defaultOptions,
	ClientEvents,
} from "./utils/constants";
import { tryAndValue } from "./utils/helpers";
import { InteractionFactory } from "./utils/Factories";

import { Rest } from "./utils/REST";

/**
 * Main Handler class, handles incoming request and outputs a response
 */
export class InteractionHandler extends (EventEmitter as unknown as new () => TypedEmitter<ClientEvents>) {
	options: HandlerOptions;
	/**
	 * Handler Rest Manager
	 */
	api: Rest;
	constructor(options: Partial<HandlerOptions> = {}) {
		super();
		this.options = Object.assign(defaultOptions, options);
		this.api = new Rest(this.options.rest);
	}
	/**
	 * Internal function for debugging conditionally
	 */
	private debug(msg: string) {
		msg = "[@DISCI/HANDLER]: " + msg;
		if (this.options.debug) {
			// if debug is enabled
			if (typeof this.options.debug === "function") this.options.debug(msg);
			else console.debug(msg);
		}

		return void 0;
	}
	/**
	 * Process a request and return a response according to the request.
	 * This does not verify the validity of the request
	 *
	 * @param body body of the received request
	 * @param signal Abort controller signal allow you to control when the handler ends (timeouts etc)
	 * @returns A json object containing data to be responded with
	 *
	 *
	 * @example
	 *
	 * ```ts
	 * // get the request here
	 *
	 * // verify it here
	 * if(!(await isVerified(request))) return new Response("Invalid Headers, Unauthorized", { status: 401 })
	 *
	 *	const timeOutAbort = new AbortController();
	 *	const timeout = setTimeout(() => {
	 *		timeOutAbort.abort("Time out");
	 *	}, 3000);
	 *
	 * try {
	 * 	const handled = await processRequest(body, timeOutAbort.signal)
	 * 	// if it resolved that means handler successfully resolved
	 * 	// remember to remove the timeout
	 * 	clearTimeout(timeout)
	 * 	// it safe to return the response as a json response
	 * 	return new Response(handled, { status: 200 })
	 * }
	 * catch {
	 * 	return new Response("Server Error", { status: 500 })
	 * }
	 * ```
	 */
	processRequest(
		body: string | Record<string, unknown>,
		signal?: AbortSignal,
	): Promise<APIInteractionResponse> {
		return new Promise((resolve, reject) => {
			// check if the request should be immediately aborted
			if (signal?.aborted) return reject(signal.reason);
			// parse the request body
			const rawInteraction = tryAndValue<APIInteraction>(
				() =>
					(typeof body === "string"
						? JSON.parse(body)
						: body) as APIInteraction,
			);
			if (!rawInteraction)
				return reject(
					`ParseError: Failed to parse received interaction to a valid interaction`,
				);
			// convert rawInteraction -> interaction
			const interaction = InteractionFactory.from(this, rawInteraction);

			if (interaction) {
				// assign a callback
				interaction.useCallback((response) => {
					this.debug(`Resolving Interaction with ${JSON.stringify(response)} `);
					return resolve(response);
				});
				// register a event to check for aborts
				if (signal) {
					signal.addEventListener("abort", () => {
						interaction.useCallback(() => {
							throw new Error(`Interaction timed out (via abort)`);
						});
						reject(signal.reason);
					});
				}

				// finally emit the event

				return this.emit("interactionCreate", interaction);
			}
			// a ping event
			else if (rawInteraction.type === InteractionType.Ping) {
				// just resolve without doing anything
				return resolve({
					type: InteractionResponseType.Pong,
				});
			} else {
				// if its not a interaction we recognize or a ping its most likely unsupported new feature
				reject(
					`UnsupportedInteraction: Unsupported Interaction of type ${rawInteraction.type} received`,
				);
			}
		});
	}
}

import { randomUUID } from 'node:crypto'
import {
	createServer,
	type IncomingMessage,
	type ServerResponse,
} from 'node:http'

interface Ticket {
	id: string
	title: string
	status: 'open'
}

class HttpError extends Error {
	constructor(
		readonly statusCode: number,
		readonly code: string,
	) {
		super(code)
	}
}

function sendJson(
	response: ServerResponse,
	statusCode: number,
	body: unknown,
	headers: Record<string, string> = {},
): void {
	response.writeHead(statusCode, {
		'Content-Type': 'application/json; charset=utf-8',
		...headers,
	})

	response.end(JSON.stringify(body))
}

async function readJson(request: IncomingMessage): Promise<unknown> {
	const contentType = request.headers['content-type']
		?.split(';')[0]
		?.trim()
		.toLowerCase()

	if (contentType !== 'application/json') {
		throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE')
	}

	const chunks: Buffer[] = []
	const maxBytes = 10_240
	let totalBytes = 0
	let exceeded = false

	for await (const chunk of request as AsyncIterable<Uint8Array>) {
		const buffer = Buffer.from(chunk)
		totalBytes += buffer.length

		if (totalBytes > maxBytes) {
			exceeded = true
			continue
		}

		if (!exceeded) {
			chunks.push(buffer)
		}
	}

	if (exceeded) {
		throw new HttpError(413, 'PAYLOAD_TOO_LARGE')
	}

	try {
		return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
	} catch {
		throw new HttpError(400, 'INVALID_JSON')
	}
}

function isTicketInput(value: unknown): value is { title: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'title' in value &&
		typeof value.title === 'string' &&
		value.title.trim().length > 0 &&
		value.title.trim().length <= 120
	)
}

export function createApp() {
	const tickets: Ticket[] = []

	return createServer((request, response) => {
		const handle = async (): Promise<void> => {
			const path = new URL(request.url ?? '/', 'http://localhost')
				.pathname

			if (path === '/health') {
				if (request.method !== 'GET') {
					sendJson(
						response,
						405,
						{ error: 'METHOD_NOT_ALLOWED' },
						{ Allow: 'GET' },
					)
					return
				}

				sendJson(response, 200, { status: 'ok' })
				return
			}

			if (path === '/v1/info') {
				if (request.method !== 'GET') {
					sendJson(
						response,
						405,
						{ error: 'METHOD_NOT_ALLOWED' },
						{ Allow: 'GET' },
					)
					return
				}

				sendJson(response, 200, {
					name: 'serviceops-api',
					version: '1.0.0',
					environment: 'development',
				})
				return
			}

			if (path === '/v1/tickets') {
				if (request.method === 'GET') {
					sendJson(response, 200, { data: tickets })
					return
				}

				if (request.method === 'POST') {
					const body = await readJson(request)

					if (!isTicketInput(body)) {
						throw new HttpError(422, 'VALIDATION_ERROR')
					}

					const ticket: Ticket = {
						id: randomUUID(),
						title: body.title.trim(),
						status: 'open',
					}

					tickets.push(ticket)

					sendJson(response, 201, ticket)
					return
				}

				sendJson(
					response,
					405,
					{ error: 'METHOD_NOT_ALLOWED' },
					{ Allow: 'GET, POST' },
				)
				return
			}

			sendJson(response, 404, {
				error: 'NOT_FOUND',
			})
		}

		void handle().catch((error: unknown) => {
			if (response.headersSent) {
				response.destroy()
				return
			}

			const knownError = error instanceof HttpError

			sendJson(response, knownError ? error.statusCode : 500, {
				error: knownError ? error.code : 'INTERNAL_SERVER_ERROR',
			})
		})
	})
}

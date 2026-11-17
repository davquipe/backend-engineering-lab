import { createServer } from 'node:http'

export function createApp() {
	return createServer((request, response) => {
		const path = new URL(request.url ?? '/', 'http://localhost').pathname

		response.setHeader('content-type', 'application/json; charset=utf-8')

		if (path === '/health') {
			if (request.method !== 'GET') {
				response.writeHead(405, { Allow: 'GET' })
				response.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }))
				return
			}

			response.writeHead(200)
			response.end(JSON.stringify({ status: 'ok' }))
			return
		}

		response.writeHead(404)
		response.end(JSON.stringify({ error: 'NOT_FOUND' }))
	})
}

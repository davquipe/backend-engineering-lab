import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { createApp } from './app.js'

test('HTTP API contract', async (t) => {
	const server = createApp()

	server.listen(0, '127.0.0.1')
	await once(server, 'listening')

	t.after(async () => {
		await new Promise<void>((resolve, reject) => {
			server.close((error) => {
				if (error) reject(error)
				else resolve()
			})
		})
	})

	const address = server.address()

	if (!address || typeof address === 'string') {
		throw new Error('Expected a TCP address')
	}

	const baseUrl = `http://127.0.0.1:${address.port}`

	await t.test('GET /health returns 200', async () => {
		const response = await fetch(`${baseUrl}/health`)

		assert.equal(response.status, 200)
		assert.deepEqual(await response.json(), { status: 'ok' })
	})

	await t.test('POST /health returns 405', async () => {
		const response = await fetch(`${baseUrl}/health`, { method: 'POST' })

		assert.equal(response.status, 405)
		assert.equal(response.headers.get('allow'), 'GET')
	})

	await t.test('unknown route returns 404', async () => {
		const response = await fetch(`${baseUrl}/unknown`)

		assert.equal(response.status, 404)
	})

	await t.test('GET /v1/info returns 200', async () => {
		const response = await fetch(`${baseUrl}/v1/info`)

		assert.equal(response.status, 200)

		assert.match(
			response.headers.get('content-type') ?? '',
			/^application\/json(?:;|$)/i,
		)

		assert.deepEqual(await response.json(), {
			name: 'serviceops-api',
			version: '1.0.0',
			environment: 'development',
		})
	})

	await t.test('POST /v1/info returns 405', async () => {
		const response = await fetch(`${baseUrl}/v1/info`, {
			method: 'POST',
		})

		assert.equal(response.status, 405)
		assert.equal(response.headers.get('allow'), 'GET')
		assert.deepEqual(await response.json(), {
			error: 'METHOD_NOT_ALLOWED',
		})
	})

	await t.test('GET /v1/tickets returns an empty list', async () => {
		const response = await fetch(`${baseUrl}/v1/tickets`)

		assert.equal(response.status, 200)
		assert.deepEqual(await response.json(), {
			data: [],
		})
	})

	await t.test('POST /v1/tickets creates a ticket', async () => {
		const response = await fetch(`${baseUrl}/v1/tickets`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				title: 'Error al iniciar sesión',
			}),
		})

		assert.equal(response.status, 201)

		const ticket: unknown = await response.json()

		assert.ok(
			typeof ticket === 'object' &&
				ticket !== null &&
				'id' in ticket &&
				typeof ticket.id === 'string',
		)

		assert.deepEqual(
			{
				title: 'title' in ticket ? ticket.title : undefined,
				status: 'status' in ticket ? ticket.status : undefined,
			},
			{
				title: 'Error al iniciar sesión',
				status: 'open',
			},
		)
	})

	await t.test('GET /v1/tickets lists created tickets', async () => {
		const response = await fetch(`${baseUrl}/v1/tickets`)

		assert.equal(response.status, 200)

		const result: unknown = await response.json()

		assert.ok(
			typeof result === 'object' &&
				result !== null &&
				'data' in result &&
				Array.isArray(result.data),
		)

		assert.equal(result.data.length, 1)
	})

	await t.test('POST /v1/tickets validates title', async () => {
		const response = await fetch(`${baseUrl}/v1/tickets`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ title: 42 }),
		})

		assert.equal(response.status, 422)
		assert.deepEqual(await response.json(), {
			error: 'VALIDATION_ERROR',
		})
	})

	await t.test('POST /v1/tickets rejects malformed JSON', async () => {
		const response = await fetch(`${baseUrl}/v1/tickets`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: '{"title":',
		})

		assert.equal(response.status, 400)
	})

	await t.test('PUT /v1/tickets returns 405', async () => {
		const response = await fetch(`${baseUrl}/v1/tickets`, {
			method: 'PUT',
		})

		assert.equal(response.status, 405)
		assert.equal(response.headers.get('allow'), 'GET, POST')
	})
})

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
})

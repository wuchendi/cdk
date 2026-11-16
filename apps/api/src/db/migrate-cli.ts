import { createDb } from './bun'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')
const { close } = await createDb(url, process.env.DATABASE_AUTH_TOKEN)
close()
console.log('migrations applied')

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { enableD1 } from '../scripts/d1-config'

describe('enableD1', () => {
  it('uncomments only the d1_databases block of wrangler.jsonc', () => {
    const source = readFileSync(
      join(import.meta.dir, '../wrangler.jsonc'),
      'utf8',
    )
    const out = enableD1(source)
    expect(source).not.toMatch(/^\s*"d1_databases"/m)
    expect(out).toMatch(/^ {2}"d1_databases": \[$/m)
    expect(out).toMatch(/^ {6}"binding": "DB",$/m)
    expect(out).toMatch(/^ {2}\],$/m)
    expect(out.split('\n')).toHaveLength(source.split('\n').length)
    expect(out.replace(/^(\s*)\/\/ /gm, '$1')).toBe(
      source.replace(/^(\s*)\/\/ /gm, '$1'),
    )
  })
  it('keeps a config whose block is already enabled', () => {
    const enabled = '{\n  "d1_databases": [\n  ],\n}'
    expect(enableD1(enabled)).toBe(enabled)
  })
  it('fails when the commented block is missing', () => {
    expect(() => enableD1('{}')).toThrow('d1_databases')
  })
})

import { expect, test } from 'claude-code/testing'
import { addedComments, syntaxFor } from './comments'

const ts = syntaxFor('a.ts')!
const py = syntaxFor('a.py')!

test('flags new what-comments in an edit', async () => {
  const found = addedComments(
    'const x = 1\n',
    '// increment the counter\nconst x = 1 + 1 // add one\n',
    ts,
  )
  expect(found.map(c => c.text)).toEqual(['increment the counter', 'add one'])
})

test('ignores comments that were already there', async () => {
  expect(addedComments('// keep\nconst a = 1', '// keep\nconst a = 2', ts)).toEqual([])
})

test('ignores directives, urls and strings', async () => {
  const src = [
    '// eslint-disable-next-line no-console',
    '// @ts-expect-error',
    'const url = "https://example.com"',
    "const s = 'a // b'",
    '#!/usr/bin/env node',
  ].join('\n')
  expect(addedComments('', src, ts)).toEqual([])
})

test('reads block and JSDoc comments as one', async () => {
  const found = addedComments('', '/**\n * Returns the user.\n * @param id the id\n */\nfunction f(id) {}', ts)
  expect(found).toHaveLength(1)
  expect(found[0]?.text).toBe('Returns the user. @param id the id')
})

test('handles hash languages', async () => {
  const found = addedComments('', '# noqa: E501\nx = 1  # set x\ny = "a # b"\n', py)
  expect(found.map(c => c.text)).toEqual(['set x'])
})

test('Edit result carries the steer as model context', async ($, on) => {
  on('tool.call', { tool: 'Edit' }, () => ({ result: { filePath: '/r/a.ts' } as never }))
  const ran = await $.tool.call({
    tool: 'Edit',
    file_path: '/r/a.ts',
    old_string: 'let n = 0',
    new_string: '// set n to zero\nlet n = 0',
  })
  expect(ran.deny).toBeUndefined()
  expect(ran.context?.join('\n')).toContain('set n to zero')
})

test('Edit with no new comment adds no context', async ($, on) => {
  on('tool.call', { tool: 'Edit' }, () => ({ result: { filePath: '/r/a.ts' } as never }))
  const ran = await $.tool.call({ tool: 'Edit', file_path: '/r/a.ts', old_string: 'a', new_string: 'b' })
  expect(ran.context ?? []).toEqual([])
})

test('markdown files are left alone', async () => {
  expect(syntaxFor('README.md')).toBeUndefined()
})

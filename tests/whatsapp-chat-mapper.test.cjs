const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')

const mapper = createLoader({})('lib/services/communications/chat-log-mapper.ts')

test('extracts Meta webhook 131047 failure details cleanly for failed chat rows', () => {
  const mapped = mapper.mapRowToChatLogItem({
    id: 47484,
    created_at: '2026-11-10T10:00:13.321Z',
    direction: 'out',
    channel: 'text',
    to_number: '351910299202',
    contact_name: 'Sandra Monteiro',
    message_text: 'Teste',
    status: 'failed',
    payload: {
      statusEvent: {
        status: 'failed',
        errors: [
          {
            code: 131047,
            title: 'Re-engagement message',
            error_data: {
              details: 'Message failed to send because more than 24 hours have passed since the customer last replied to this number.',
            },
          },
        ],
      },
    },
  })

  assert.equal(mapped.status, 'failed')
  assert.equal(
    mapped.error_reason,
    '[131047] Message failed to send because more than 24 hours have passed since the customer last replied to this number.'
  )
})


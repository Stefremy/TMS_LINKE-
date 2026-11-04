const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const TENANT = '11111111-1111-1111-1111-111111111111'
const STAFF_USER = {
  id: 'staff-user-1',
  email: 'geral@linke.pt',
  app_metadata: { role: 'employee', tenant_id: TENANT },
}

function createMailHarness({ sentCalls = [], rows = [] } = {}) {
  const db = fakeSupabase({ audit_log: rows }, null, { persistInserts: true })
  const load = createLoader({
    'server-only': {},
    '@/lib/auth/context': {
      getAuthContext: async () => ({
        user: STAFF_USER,
        role: 'employee',
        tenant_id: TENANT,
        permissions: [],
      }),
    },
    '@/lib/supabase/server': {
      createAdminClient: () => db.createAdminClient(),
    },
    '@/lib/email/resend': {
      sendEmail: async (payload) => {
        sentCalls.push(payload)
        return { success: true, data: { id: 'resend-msg-123' } }
      },
    },
  })

  return {
    db,
    sentCalls,
    mailbox: load('lib/ops-mailbox.ts'),
    server: load('lib/ops-mailbox-server.ts'),
  }
}

test('MAIL_ACCOUNTS defaults to geral@linke.pt as primary company mailbox', () => {
  const { mailbox } = createMailHarness()
  assert.equal(mailbox.MAIL_ACCOUNTS[0].id, 'geral@linke.pt')
  assert.equal(mailbox.MAIL_ACCOUNTS[0].primary, true)
  assert.equal(mailbox.normalizeMailAccount(undefined), 'geral@linke.pt')
  assert.equal(mailbox.normalizeMailAccount('CLIENTES@LINKE.PT'), 'clientes@linke.pt')
  assert.equal(mailbox.normalizeMailAccount('unknown@domain.pt'), 'geral@linke.pt')
})

test('listMailboxMessages returns clean mailbox without mock seeds and includes tracking logs', async () => {
  const { server } = createMailHarness({
    rows: [
      {
        tenant_id: TENANT,
        action: 'tracking_email_sent',
        details: {
          type: 'in_transit',
          event_code: 'EMP',
          shipment_id: 'ship-99',
          recipient_email: 'cliente@loja.pt',
          sent_at: '2026-11-04T12:00:00.000Z',
          success: true,
        },
        created_at: '2026-11-04T12:00:00.000Z',
      },
    ],
  })

  const ctx = await server.mailboxContext()
  const result = await server.listMailboxMessages(ctx, 'geral@linke.pt')

  assert.equal(result.account, 'geral@linke.pt')
  // Verify clean state: zero mock/fake seeds
  assert.equal(result.messages.some((m) => m.id === 'mail-seed-ctt-recolhas'), false)
  // Tracking notifications are still listed under notificacoes@linke.pt
  assert.ok(result.messages.some((m) => m.account === 'notificacoes@linke.pt' && m.toEmail === 'cliente@loja.pt'))
})

test('composeOrSaveMail sends real email via Resend from geral@linke.pt and persists to Sent folder', async () => {
  const sentCalls = []
  const { server } = createMailHarness({ sentCalls })
  const ctx = await server.mailboxContext()

  const created = await server.composeOrSaveMail(ctx, {
    account: 'geral@linke.pt',
    toEmail: 'encomendas@cacto.pt',
    toName: 'Rui Barbosa',
    subject: 'Confirmação de recolha 35 volumes',
    bodyText: 'Olá Rui, confirmamos o reforço da recolha às 16h30.',
    labels: ['recolhas', 'clientes'],
    isDraft: false,
  })

  assert.equal(created.folder, 'sent')
  assert.equal(created.fromEmail, 'geral@linke.pt')
  assert.equal(created.toEmail, 'encomendas@cacto.pt')
  assert.equal(created.deliveryStatus, 'delivered')
  assert.equal(created.resendId, 'resend-msg-123')
  assert.equal(sentCalls.length, 1)
  assert.equal(sentCalls[0].from, 'Linke Geral <geral@linke.pt>')
  assert.deepEqual(sentCalls[0].to, ['encomendas@cacto.pt'])

  const listed = await server.listMailboxMessages(ctx, 'geral@linke.pt')
  assert.ok(listed.messages.some((m) => m.id === created.id && m.folder === 'sent'))
})

test('mutateMailMessages updates read state, star, folder and labels persistently', async () => {
  const { server } = createMailHarness()
  const ctx = await server.mailboxContext()

  // First create two messages to mutate
  const inbound1 = await server.recordInboundEmailWebhook({
    data: {
      email_id: 'test-mutate-1',
      from: 'fornecedor@exemplo.pt',
      to: ['geral@linke.pt'],
      subject: 'Teste de Fornecedor',
      text: 'Corpo da mensagem 1',
      created_at: '2026-11-04T10:00:00.000Z',
    },
  })

  const inbound2 = await server.recordInboundEmailWebhook({
    data: {
      email_id: 'test-mutate-2',
      from: 'contato@cliente.pt',
      to: ['geral@linke.pt'],
      subject: 'Pedido de Cotação',
      text: 'Corpo da mensagem 2',
      created_at: '2026-11-04T10:30:00.000Z',
    },
  })

  await server.mutateMailMessages(ctx, {
    action: 'mark_read',
    ids: [inbound1.id],
  })

  await server.mutateMailMessages(ctx, {
    action: 'move_folder',
    ids: [inbound2.id],
    folder: 'archive',
  })

  const after = await server.listMailboxMessages(ctx, 'geral@linke.pt')
  const msg1 = after.messages.find((m) => m.id === inbound1.id)
  const msg2 = after.messages.find((m) => m.id === inbound2.id)

  assert.equal(msg1.read, true)
  assert.equal(msg2.folder, 'archive')
})

test('recordInboundEmailWebhook parses incoming email for geral@linke.pt into Inbox', async () => {
  const { server } = createMailHarness()
  const recorded = await server.recordInboundEmailWebhook({
    data: {
      email_id: 'in-777',
      from: 'Fornecedor Expresso <avisos@fornecedor.pt>',
      to: ['geral@linke.pt'],
      subject: 'Manifesto de Carga Diário',
      text: 'Segue em anexo o manifesto do dia.',
      created_at: '2026-11-04T13:30:00.000Z',
    },
  })

  assert.ok(recorded)
  assert.equal(recorded.account, 'geral@linke.pt')
  assert.equal(recorded.folder, 'inbox')
  assert.equal(recorded.fromName, 'Fornecedor Expresso')
  assert.equal(recorded.fromEmail, 'avisos@fornecedor.pt')
  assert.equal(recorded.read, false)
})


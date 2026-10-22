function readField(row, field) {
  const [column, key] = field.split('->>')
  return key ? row[column]?.[key] : row[column]
}

function matchesLike(value, pattern) {
  let source = ''
  const escape = c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '\\') source += escape(pattern[++i] || '')
    else source += c === '%' ? '.*' : c === '_' ? '.' : escape(c)
  }
  return new RegExp(`^${source}$`, 'i').test(String(value ?? ''))
}

function fakeSupabase(tables, failure, options = {}) {
  const queries = []
  const writes = []
  let adminClients = 0
  function from(table) {
    const state = { table, filters: [], limit: Infinity, single: false }
    const query = {
      select(projection, options) { state.projection = projection; state.count = options?.count; if (state.write) state.returnRows = true; return query },
      eq(field, value) { state.filters.push({ field, value, kind: 'eq' }); return query },
      gte(field, value) { state.filters.push({ field, value, kind: 'gte' }); return query },
      lte(field, value) { state.filters.push({ field, value, kind: 'lte' }); return query },
      ilike(field, value) { state.filters.push({ field, value, kind: 'ilike' }); return query },
      in(field, value) { state.filters.push({ field, value, kind: 'in' }); return query },
      order(field, options) { (state.orders ||= []).push({ field, ...options }); return query },
      limit(value) { state.limit = value; return query },
      range(start, end) { state.range = [start, end]; return query },
      maybeSingle() { state.single = true; return query },
      single() { state.single = true; return query },
      insert(value) { state.write = { table, kind: 'insert', value }; return query },
      update(value) { state.write = { table, kind: 'update', value }; return query },
      delete() { state.write = { table, kind: 'delete' }; return query },
      upsert(value) { state.write = { table, kind: 'upsert', value }; return query },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          queries.push(state)
          const error = failure?.(state)
          if (error) return { data: null, error }
          let rows = (tables[table] || []).filter(row => state.filters.every(filter => {
            const value = readField(row, filter.field)
            return filter.kind === 'ilike' ? matchesLike(value, filter.value)
              : filter.kind === 'gte' ? value >= filter.value
              : filter.kind === 'lte' ? value <= filter.value
              : filter.kind === 'in' ? filter.value.includes(value) : value === filter.value
          }))
          if (state.write) {
            if (state.write.kind === 'insert' && options.persistInserts) {
              const entries = (Array.isArray(state.write.value) ? state.write.value : [state.write.value])
                .map(value => ({ created_at: new Date().toISOString(), ...structuredClone(value) }))
              if (entries.some(value => value.id && (tables[table] || []).some(row => row.id === value.id))) {
                return { data: null, error: { code: '23505', message: 'Duplicate primary key' } }
              }
              tables[table] ||= []
              tables[table].push(...entries)
              rows = entries
            }
            writes.push(state.write)
            if (state.write.kind === 'delete') tables[table] = (tables[table] || []).filter(row => !rows.includes(row))
            else if (state.write.kind === 'update') rows.forEach(row => Object.assign(row, structuredClone(state.write.value)))
            // Existing insert/upsert fixtures record payloads without emulating defaults or constraints.
            if (!state.returnRows) return { data: null, error: null }
          }
          if (state.orders) rows = [...rows].sort((a, b) => {
            for (const order of state.orders) {
              const comparison = String(a[order.field] || '').localeCompare(String(b[order.field] || ''))
              if (comparison) return order.ascending === false ? -comparison : comparison
            }
            return 0
          })
          const count = rows.length
          rows = rows.slice(0, state.limit)
          if (state.range) rows = rows.slice(state.range[0], state.range[1] + 1)
          if (state.single && rows.length > 1) return { data: null, error: { message: 'Expected at most one row' } }
          // PostgREST JSON projections return flat aliases, not the whole JSON document.
          if (state.projection?.includes('->')) {
            rows = rows.map(row => Object.fromEntries(state.projection.split(',').map(part => {
              const expression = part.trim()
              const m = /^(?:(\w+):)?(\w+)->(>)?(\w+)$/.exec(expression)
              if (!m) return [expression, row[expression]]
              const value = row[m[2]]?.[m[4]] ?? null
              return [m[1] || m[4], m[3] && value !== null ? String(value) : value]
            })))
          }
          return { data: structuredClone(state.single ? rows[0] || null : rows), error: null, ...(state.count ? { count } : {}) }
        }).then(resolve, reject)
      },
    }
    return query
  }
  // Application-contract mocks only. The actual financial SQL (rollback, permissions,
  // constraints and serialized reservations) is executed in wallet-sql.test.cjs.
  async function rpc(name, p) {
    if (name === 'save_client_financial_profile') {
      const profiles = (tables.audit_log || []).filter(r => r.tenant_id === p.p_tenant && r.action === 'client_data' && r.details.id === p.p_client)
      const owner = (tables.clients || []).find(r => r.id === p.p_client && r.tenant_id === p.p_tenant)
      if (!owner || p.p_details.id !== p.p_client) return { data: null, error: { message: 'Client binding mismatch' } }
      const inserted = await from('audit_log').insert({ id: `fixture-profile-${queries.length}`, tenant_id: p.p_tenant, action: 'client_data', details: p.p_details })
      if (inserted.error) return inserted
      if (profiles.length) {
        const deleted = await from('audit_log').delete().eq('tenant_id', p.p_tenant).eq('action', 'client_data').in('id', profiles.map(r => r.id))
        if (deleted.error) return deleted
      }
      return { data: null, error: null }
    }
    if (name === 'reserve_shipment_wallet') {
      const profile = (tables.audit_log || []).find(r => r.tenant_id === p.p_tenant && r.action === 'client_data' && r.details.id === p.p_client)
      if (!profile) return { data: null, error: { message: 'Profile missing' } }
      if (profile.details.billing_type !== 'pay_as_you_go') return { data: { reserved: false }, error: null }
      const rows = (tables.shipments || []).filter(s => s.tenant_id === p.p_tenant && s.client_id === p.p_client && s.status !== 'anulado')
      const holds = (tables.wallet_reservations || []).filter(r => r.tenant_id === p.p_tenant && r.client_id === p.p_client && r.state !== 'released' && !rows.some(s => s.id === r.shipment_id))
      const balance = Number(profile.details.credit_limit) - rows.reduce((n,s) => n + Number(s.sell_price),0) - holds.reduce((n,r) => n+r.amount,0)
      if (balance - p.p_amount < -2) return { data: { refused: true, balance }, error: null }
      ;(tables.wallet_reservations ||= []).push({ shipment_id: p.p_shipment, tenant_id: p.p_tenant, client_id: p.p_client, amount: p.p_amount, state: 'reserved' })
      return { data: { reserved: true, balance }, error: null }
    }
    if (name === 'transition_wallet_reservation') {
      const row = (tables.wallet_reservations || []).find(r => r.shipment_id === p.p_shipment && r.tenant_id === p.p_tenant && r.client_id === p.p_client && r.state === p.p_from)
      if (row) Object.assign(row, { state: p.p_to, result: p.p_result })
      return { data: Boolean(row), error: null }
    }
    throw new Error(`Unmocked RPC: ${name}`)
  }
  const client = { from, rpc }
  return { client, queries, writes, createAdminClient() { adminClients++; return client }, get adminClients() { return adminClients } }
}

module.exports = { fakeSupabase }

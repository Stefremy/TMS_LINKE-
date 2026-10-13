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

function fakeSupabase(tables, failure) {
  const queries = []
  const writes = []
  let adminClients = 0
  function from(table) {
    const state = { table, filters: [], limit: Infinity, single: false }
    const query = {
      select() { return query },
      eq(field, value) { state.filters.push({ field, value, kind: 'eq' }); return query },
      ilike(field, value) { state.filters.push({ field, value, kind: 'ilike' }); return query },
      in(field, value) { state.filters.push({ field, value, kind: 'in' }); return query },
      order(field, options) { state.order = { field, ...options }; return query },
      limit(value) { state.limit = value; return query },
      maybeSingle() { state.single = true; return query },
      single() { state.single = true; return query },
      insert(value) { state.write = { table, kind: 'insert', value }; return query },
      update(value) { state.write = { table, kind: 'update', value }; return query },
      upsert(value) { state.write = { table, kind: 'upsert', value }; return query },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          queries.push(state)
          const error = failure?.(state)
          if (error) return { data: null, error }
          if (state.write) { writes.push(state.write); return { data: null, error: null } }
          let rows = (tables[table] || []).filter(row => state.filters.every(filter => {
            const value = readField(row, filter.field)
            return filter.kind === 'ilike' ? matchesLike(value, filter.value)
              : filter.kind === 'in' ? filter.value.includes(value) : value === filter.value
          }))
          if (state.order) rows = [...rows].sort((a, b) => {
            const comparison = String(a[state.order.field] || '').localeCompare(String(b[state.order.field] || ''))
            return state.order.ascending === false ? -comparison : comparison
          })
          rows = rows.slice(0, state.limit)
          return { data: state.single ? rows[0] || null : rows, error: null }
        }).then(resolve, reject)
      },
    }
    return query
  }
  const client = { from }
  return { client, queries, writes, createAdminClient() { adminClients++; return client }, get adminClients() { return adminClients } }
}

module.exports = { fakeSupabase }

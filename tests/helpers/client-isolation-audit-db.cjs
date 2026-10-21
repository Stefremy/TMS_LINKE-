// Controlled PostgREST subset for isolation audits. No network, RLS or SQL grants are emulated.
function auditDatabase(initial, failure) {
  const tables = structuredClone(initial)
  const queries = [], writes = []
  const field = (row, name) => {
    const [column, key] = name.split('->>')
    return key ? row[column]?.[key] : row[column]
  }
  function from(table) {
    const state = { table, filters: [], ors: [], orders: [], limit: Infinity }
    const q = {
      select(projection = '*', options) { state.projection = projection; state.count = options?.count; return q },
      eq(name, value) { state.filters.push({ name, value, kind: 'eq' }); return q },
      in(name, value) { state.filters.push({ name, value, kind: 'in' }); return q },
      not(name, operator, value) {
        if (operator !== 'in') throw new Error('Unsupported audit NOT operator: ' + operator)
        state.filters.push({ name, value: JSON.parse('[' + value.slice(1, -1) + ']'), kind: 'not-in' })
        return q
      },
      gte(name, value) { state.filters.push({ name, value, kind: 'gte' }); return q },
      lte(name, value) { state.filters.push({ name, value, kind: 'lte' }); return q },
      contains(name, value) { state.filters.push({ name, value, kind: 'contains' }); return q },
      or(expression) {
        state.ors.push(expression.split(',').map(term => {
          const match = /^([a-z_]+)\.eq\.(.+)$/.exec(term)
          if (!match) throw new Error('Unsupported audit OR expression: ' + term)
          return { name: match[1], value: match[2] }
        }))
        return q
      },
      order(name, options = {}) { state.orders.push({ name, ascending: options.ascending !== false }); return q },
      limit(value) { state.limit = value; return q },
      range(start, end) { state.range = [start, end]; return q },
      single() { state.single = true; return q },
      maybeSingle() { state.single = true; return q },
      insert(value) { state.write = { kind: 'insert', value }; return q },
      update(value) { state.write = { kind: 'update', value }; return q },
      delete() { state.write = { kind: 'delete' }; return q },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          queries.push(state)
          const error = failure?.(state)
          if (error) return { data: null, error }
          let rows = (tables[table] || []).filter(row =>
            state.filters.every(f => {
              const v = field(row, f.name)
              if (f.kind === 'in') return f.value.includes(v)
              if (f.kind === 'not-in') return !f.value.includes(v)
              if (f.kind === 'gte') return v >= f.value
              if (f.kind === 'lte') return v <= f.value
              if (f.kind === 'contains') return Object.entries(f.value).every(([key, value]) => v?.[key] === value)
              return v === f.value
            }) && state.ors.every(group => group.some(f => String(field(row, f.name)) === f.value))
          )
          if (state.write) {
            writes.push({ table, ...structuredClone(state.write), filters: structuredClone(state.filters) })
            if (state.write.kind === 'update') rows.forEach(row => Object.assign(row, structuredClone(state.write.value)))
            if (state.write.kind === 'delete') tables[table] = (tables[table] || []).filter(row => !rows.includes(row))
            if (state.write.kind === 'insert') {
              rows = [state.write.value].flat().map(row => ({ id: 'fixture-write-' + writes.length, ...structuredClone(row) }))
              ;(tables[table] ||= []).push(...rows)
            }
          }
          rows = [...rows].sort((a, b) => {
            for (const o of state.orders) {
              const comparison = String(field(a, o.name) || '').localeCompare(String(field(b, o.name) || ''))
              if (comparison) return o.ascending ? comparison : -comparison
            }
            return 0
          })
          const count = rows.length
          rows = rows.slice(0, state.limit)
          if (state.range) rows = rows.slice(state.range[0], state.range[1] + 1)
          if (state.single && rows.length > 1) return { data: null, error: { message: 'More than one fixture row' } }
          return { data: structuredClone(state.single ? rows[0] || null : rows), count, error: null }
        }).then(resolve, reject)
      },
    }
    return q
  }
  return { tables, queries, writes, client: { from } }
}
module.exports = { auditDatabase }

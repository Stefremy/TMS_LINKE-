/** Operations status combines the customer record with current portal restrictions. */
export function clientListStatus(client: {
  is_active: boolean
  portal_access_status?: 'active' | 'suspended' | 'blocked'
}): 'Ativo' | 'Inativo' | 'Suspenso' | 'Bloqueado' {
  if (client.portal_access_status === 'blocked') return 'Bloqueado'
  if (client.portal_access_status === 'suspended') return 'Suspenso'
  return client.is_active ? 'Ativo' : 'Inativo'
}

export function matchesClientStatus(client: Parameters<typeof clientListStatus>[0], filter: string): boolean {
  const status = clientListStatus(client)
  return filter === 'Todos' || (filter === 'Inativo' ? status !== 'Ativo' : status === filter)
}

export function unwrapSnapshot(v) {
  if (v && typeof v === 'object' && 'type' in v && 'value' in v && Object.keys(v).length === 2) {
    return unwrapSnapshot(v.value)
  }
  if (Array.isArray(v)) return v.map(unwrapSnapshot)
  return v
}

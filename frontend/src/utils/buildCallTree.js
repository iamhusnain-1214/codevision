/**
 * Reconstructs a call tree from the flat trace array that
 * trace_function(..., track_call_stack=True) produces.
 *
 * The backend only gives us a flat list of {call_stack: [...]} snapshots
 * per line, plus separate {event:'return', function, call_stack_depth}
 * entries when a frame pops — it never emits an explicit "call" record.
 * So we detect a new call by noticing call_stack grew by one entry
 * compared to the previous line-step, and detect a return via the
 * existing `event: 'return'` marker.
 *
 * Returns: { nodes: Map<id, node>, rootId, order: number[] }
 * node = { id, parentId, funcName, args, returnValue, createdStep, returnedStep }
 */
export default function buildCallTree(trace) {
  const nodes = []
  let nextId = 0
  let stackIds = [] // node ids, parallel to the backend's call_stack array

  trace.forEach((step, idx) => {
    const cs = step.call_stack || []

    // New frame(s) pushed since the last line-step we saw.
    while (stackIds.length < cs.length) {
      const depth = stackIds.length
      const callInfo = cs[depth] || {}
      const parentId = stackIds.length > 0 ? stackIds[stackIds.length - 1] : null
      const id = nextId++
      nodes.push({
        id,
        parentId,
        funcName: callInfo.function,
        args: callInfo.args || {},
        returnValue: undefined,
        createdStep: idx,
        returnedStep: null,
      })
      stackIds.push(id)
    }

    // Keep the currently-active (top) frame's arg snapshot fresh as its
    // locals evolve line by line.
    if (cs.length > 0 && cs.length === stackIds.length) {
      const topId = stackIds[stackIds.length - 1]
      const node = nodes[topId]
      if (node) node.args = cs[cs.length - 1].args || node.args
    }

    // A frame just returned — pop it and record the return value.
    if (step.event === 'return' && stackIds.length > 0) {
      const poppedId = stackIds.pop()
      const node = nodes[poppedId]
      if (node) {
        node.returnValue = step.variables?.return_value
        node.returnedStep = idx
      }
    }
  })

  const rootId = nodes.length > 0 ? 0 : null
  return { nodes, rootId }
}

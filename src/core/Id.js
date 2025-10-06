let counter = 0;

export function generateId(prefix = 'id') {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function resetIdCounter(value = 0) {
  counter = value;
}

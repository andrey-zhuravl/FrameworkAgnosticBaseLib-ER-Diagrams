export function point(x = 0, y = 0) {
  return { x, y };
}

export function addPoint(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtractPoint(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scalePoint(p, scale) {
  return { x: p.x * scale, y: p.y * scale };
}

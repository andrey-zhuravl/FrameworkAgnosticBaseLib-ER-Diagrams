export function rect(x, y, width, height) {
  return { x, y, width, height };
}

export function containsRect(r, x, y) {
  return x >= r.x && y >= r.y && x <= r.x + r.width && y <= r.y + r.height;
}

export function inflateRect(r, amount) {
  return {
    x: r.x - amount,
    y: r.y - amount,
    width: r.width + amount * 2,
    height: r.height + amount * 2,
  };
}

export function intersectsRect(a, b) {
  return !(
    a.x + a.width < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  );
}

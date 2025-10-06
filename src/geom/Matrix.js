export class Matrix {
  constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
  }

  static identity() {
    return new Matrix();
  }

  translate(tx, ty) {
    this.e += tx;
    this.f += ty;
    return this;
  }

  scale(sx, sy = sx) {
    this.a *= sx;
    this.d *= sy;
    this.c *= sx;
    this.b *= sy;
    this.e *= sx;
    this.f *= sy;
    return this;
  }

  applyToPoint(x, y) {
    return {
      x: x * this.a + y * this.c + this.e,
      y: x * this.b + y * this.d + this.f,
    };
  }
}

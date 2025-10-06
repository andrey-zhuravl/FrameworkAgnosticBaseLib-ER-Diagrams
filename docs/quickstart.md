# ERCanvas Quick Start

This library renders entity-relationship diagrams on a plain HTML5 canvas. It is framework-agnostic and exposes a single facade class `ERCanvas` for managing the scene, rendering, and interactions.

## Installation

For local development clone the repository and use the source files directly in an ES module environment. A minimal ESM bundle is exported from `dist/er-canvas.esm.js`.

```html
<script type="module">
  import { ERCanvas } from './dist/er-canvas.esm.js';
  const er = new ERCanvas(document.querySelector('#app'));
  er.start();
</script>
```

## Creating tables and edges

```js
const usersId = er.addTable({
  name: 'Users',
  position: { x: 120, y: 80 },
  fields: [
    { id: 'id', name: 'id', type: 'uuid', isPrimaryKey: true },
    { id: 'email', name: 'email', type: 'text', isUnique: true },
  ],
});

const postsId = er.addTable({
  name: 'Posts',
  position: { x: 420, y: 120 },
  fields: [
    { id: 'id', name: 'id', type: 'uuid', isPrimaryKey: true },
    { id: 'user_id', name: 'user_id', type: 'uuid', isForeignKey: true },
  ],
});

er.connect({
  from: { tableId: usersId, fieldId: 'id' },
  to: { tableId: postsId, fieldId: 'user_id' },
  cardinality: { from: '1', to: 'N' },
});
```

## Serialization

```js
const snapshot = er.toJSON();
localStorage.setItem('diagram', JSON.stringify(snapshot));

const stored = JSON.parse(localStorage.getItem('diagram'));
er.fromJSON(stored);
```

## Events

```js
er.on('selection:change', (selection) => {
  console.log('Selected tables:', selection.tables);
});
```

See `examples/basic.html` for a runnable example.

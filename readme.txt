# Framework-Agnostic ER Diagram Canvas Library

This repository contains a minimal JavaScript library for rendering Entity Relationship diagrams on an HTML5 canvas without any framework dependencies. The library focuses on low-level primitives for drawing tables, fields, and connections alongside interaction helpers (selection, dragging, pan/zoom, connection preview) and JSON serialization.

## Structure

```
src/
  core/           // foundational utilities (event emitter, ids, helpers)
  geom/           // geometry helpers used for hit testing and transforms
  model/          // scene graph models for tables, fields, and edges
  render/         // canvas renderer, theming, and grid layer
  input/          // controllers for mouse input, selection, drag, connect
  state/          // global state store and undo/redo command stack
  io/             // serializer for diagram import/export
  facade/         // public ERCanvas facade entry point
  index.js        // top-level re-export for bundlers and ES modules
examples/         // runnable vanilla JS demo using ES modules
docs/             // quick start and API notes
dist/             // prebuilt entry points (ESM and UMD bundles + type defs)
```

## Usage

See `examples/basic.html` for a complete example that instantiates `ERCanvas`, creates two tables, connects them, and listens to selection events.

Key capabilities exposed by `ERCanvas` include:

- Scene graph mutations via `addTable`, `addField`, `connect`, `removeTable`, etc.
- Interaction helpers for pan, zoom, select, drag, and connect gestures.
- JSON serialization (`toJSON`) and hydration (`fromJSON`).
- Theming and grid customization at runtime (`setTheme`, `setGrid`).
- Event emitter for reacting to render lifecycle and model changes.

## Development

The source files are authored as ES modules and can be consumed directly in modern browsers. Optional build scripts can be added for packaging (`package.json` contains placeholders for bundling and testing).

Start the basic example by serving the repository with any static file server and navigating to `examples/basic.html` in a modern browser.

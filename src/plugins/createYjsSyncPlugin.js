const DEFAULT_MAP_NAME = 'er-canvas';
const DEFAULT_SCENE_KEY = 'scene';

/**
 * Creates a plugin that synchronizes ERCanvas state with a Yjs document.
 *
 * Usage:
 * ```js
 * import * as Y from 'yjs';
 * import { WebrtcProvider } from 'y-webrtc';
 * import { ERCanvas, createYjsSyncPlugin } from 'er-canvas';
 *
 * const doc = new Y.Doc();
 * const provider = new WebrtcProvider('room-name', doc);
 * ERCanvas.use(createYjsSyncPlugin({ doc, provider }));
 * ```
 */
export function createYjsSyncPlugin({
  doc,
  mapName = DEFAULT_MAP_NAME,
  sceneKey = DEFAULT_SCENE_KEY,
  provider,
  onSynced,
} = {}) {
  if (!doc || typeof doc.getMap !== 'function') {
    throw new Error('createYjsSyncPlugin requires a Y.Doc instance via the "doc" option');
  }

  return ({ er }) => {
    const sharedMap = doc.getMap(mapName);
    const cleanup = [];
    let isApplyingRemote = false;
    let isPushingLocal = false;

    const serializeScene = () => JSON.stringify(er.toJSON());

    const applySharedState = () => {
      const snapshot = sharedMap.get(sceneKey);
      if (typeof snapshot !== 'string') return;
      isApplyingRemote = true;
      try {
        const data = JSON.parse(snapshot);
        er.fromJSON(data);
        er.renderer.drawFrame();
        if (typeof onSynced === 'function') {
          onSynced({ source: 'remote', data });
        }
      } catch (err) {
        console.warn('Yjs sync: failed to apply remote scene', err);
      } finally {
        isApplyingRemote = false;
      }
    };

    const pushLocalState = () => {
      if (isApplyingRemote) return;
      isPushingLocal = true;
      try {
        const serialized = serializeScene();
        if (sharedMap.get(sceneKey) !== serialized) {
          sharedMap.set(sceneKey, serialized);
        }
        if (typeof onSynced === 'function') {
          onSynced({ source: 'local', data: er.toJSON() });
        }
      } finally {
        isPushingLocal = false;
      }
    };

    const observer = () => {
      if (isPushingLocal) return;
      applySharedState();
    };

    sharedMap.observe(observer);

    if (provider && typeof provider.connect === 'function' && provider.shouldConnect !== false) {
      provider.connect();
    }

    if (!sharedMap.has(sceneKey)) {
      pushLocalState();
    } else {
      applySharedState();
    }

    const syncEvents = [
      'table:add',
      'table:update',
      'table:remove',
      'field:add',
      'field:update',
      'field:remove',
      'field:reorder',
      'edge:add',
      'edge:update',
      'edge:remove',
      'scene:load',
    ];

    syncEvents.forEach((eventName) => {
      cleanup.push(er.on(eventName, pushLocalState));
    });

    const originalDestroy = er.destroy.bind(er);
    er.destroy = () => {
      sharedMap.unobserve(observer);
      cleanup.forEach((off) => off());
      if (provider && typeof provider.disconnect === 'function') {
        provider.disconnect();
      }
      originalDestroy();
    };
  };
}

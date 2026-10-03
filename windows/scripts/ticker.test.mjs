import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

class Element {
  children = [];
  style = {};
  textContent = '';
  append(...children) { this.children.push(...children); }
  setAttribute() {}
}

test('ticker replaces text when agents switch or bounded history advances', async () => {
  globalThis.document = {
    createElement: () => new Element(),
    createElementNS: () => new Element(),
  };
  const result = await build({ entryPoints: [fileURLToPath(new URL('../src/views/ticker.ts', import.meta.url))],
    bundle: true, write: false, platform: 'node', format: 'esm' });
  const { Ticker } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  const ticker = new Ticker();
  const currentText = () => ticker.el.children[1].children[1].children[0].textContent;
  ticker.sync({ id: 'agent_codex', steps: ['Read project'], stepIndex: 0 });
  assert.equal(currentText(), 'Read project');
  ticker.sync({ id: 'agent_antigravity', steps: ['Edit file'], stepIndex: 0 });
  assert.equal(currentText(), 'Edit file');
  ticker.sync({ id: 'agent_antigravity', steps: ['Run build'], stepIndex: 0 });
  assert.equal(currentText(), 'Run build');
});

importScripts('https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js');

let tokenizer = null;

kuromoji.builder({ dicPath: 'https://unpkg.com/kuromoji@0.1.2/dict/' })
  .build((err, t) => {
    if (err) {
      postMessage({ type: 'error', message: err.message });
      return;
    }
    tokenizer = t;
    postMessage({ type: 'ready' });
  });

self.onmessage = (e) => {
  if (e.data.type === 'tokenize') {
    if (!tokenizer) {
      postMessage({ type: 'error', message: '词典尚未加载完成' });
      return;
    }
    const tokens = tokenizer.tokenize(e.data.text);
    postMessage({ type: 'result', tokens });
  }
};

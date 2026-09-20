// qpdf-wasm 의 Emscripten 코드는 노드에서만 fs·path 를 부르고 브라우저에서는 부르지 않습니다.
// 번들러가 "fs 를 찾을 수 없다"고 멈추지 않도록 브라우저 빌드에서만 이 빈 모듈로 바꿔 줍니다(next.config.ts).
const empty = {};
export default empty;

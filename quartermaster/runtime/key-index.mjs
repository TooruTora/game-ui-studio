/**
 * key-index.mjs
 * Quartermaster v0.3 — K-C 키 인덱스 재구성기 (MVP 비활성 스텁)
 * ESM, Node>=18, 외부 의존성 0.
 *
 * MVP에서 비활성: K-B(QmManaged 마커)가 진실원천.
 * 실제 인덱스 재구성은 M4 이후 트랙 B에서 구현 예정.
 *
 * export function rebuildIndex(tree) → Map
 */

/**
 * K-C 키 인덱스 재구성기 — MVP 비활성 스텁.
 *
 * TODO(M4): 실제 구현 시 Unity 프리팹 트리를 순회하며
 *   QmManaged.stableKey → GameObject 참조 매핑을 구성한다.
 *   현재는 K-B(QmManaged 마커 컴포넌트)가 진실원천이므로
 *   이 함수는 사용되지 않는다.
 *
 * @param {any} tree - 프리팹 트리 (현재 미사용)
 * @returns {Map} 빈 Map (스텁)
 */
export function rebuildIndex(tree) {
  // MVP에서 비활성. K-B(QmManaged 마커)가 진실원천.
  // TODO(M4): tree를 순회하며 stableKey→node 맵을 구성.
  return new Map();
}

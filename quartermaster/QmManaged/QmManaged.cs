// Quartermaster — 파이프라인 관리 마커 컴포넌트
//
// 이 .cs는 "사용자 View/로직 코드"가 아니다. 파이프라인이 사용자 Unity 프로젝트
// Assets/Quartermaster/ 아래로 동기화하는 고정 부품이다 (P2 정밀화: "사용자 View/로직
// .cs 미생성"이지 "모든 .cs 미배포"가 아님).
//
// 역할: 매니페스트 element.key를 stableKey로 프리팹 인스턴스에 박아, fileID/GUID
// 휘발성과 무관하게 멱등 재조립의 안정 식별자를 제공한다 (D-A 키영속 K-B = 진실원천).
// CONTRACT.md (i): manifest.element.key === QmManaged.stableKey.

using System;
using UnityEngine;

namespace Quartermaster
{
    /// <summary>
    /// 파이프라인이 관리하는 UI element 마커. 안정 키와 마지막으로 적용된
    /// 관리 오버라이드 메타를 보관한다. 사람이 부착한 View 컴포넌트·참조·수동
    /// 오버라이드는 이 컴포넌트와 무관하게 보존된다.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class QmManaged : MonoBehaviour
    {
        [Tooltip("매니페스트 element.key. 재조립 add/update 매칭의 기준. 수동 편집 금지.")]
        [SerializeField] private string stableKey;

        [Tooltip("이 element를 만든 카탈로그 component ID.")]
        [SerializeField] private string componentId;

        [Tooltip("파이프라인이 마지막으로 적용한 관리 오버라이드(JSON). machine-set vs human-set 판정용.")]
        [SerializeField, TextArea] private string lastAppliedOverrides;

        [Tooltip("매니페스트 schemaVersion. 마이그레이션 판정용.")]
        [SerializeField] private int schemaVersion = 1;

        public string StableKey => stableKey;
        public string ComponentId => componentId;
        public string LastAppliedOverrides => lastAppliedOverrides;
        public int SchemaVersion => schemaVersion;

        /// <summary>파이프라인(merge-applier) 전용. 사람이 호출하지 않는다.</summary>
        public void ApplyManaged(string key, string component, string overridesJson, int version)
        {
            stableKey = key;
            componentId = component;
            lastAppliedOverrides = overridesJson;
            schemaVersion = version;
        }
    }
}

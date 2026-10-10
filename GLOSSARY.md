# Korean glossary

Terms used across the dsh Web UI and the Korean rendering this pack uses. Pick the rendering below whenever a term recurs; add a row when a new recurring term appears.

## Style

- Sentences, descriptions, errors and status messages use formal 합니다체: "파일을 열 수 없습니다.", "설정을 저장했습니다."
- Labels, buttons, menu items, tabs and column titles are nouns or short noun phrases: "저장", "다시 시도", "설정".
- Progress labels end in "중" ("파일 읽는 중"); finished-step labels end in "함" or "음" ("파일 읽음", "명령 실행함").
- Follow the English punctuation: a final period only where English has one, and keep "…".
- Keep `{placeholder}` tokens exactly. Never attach a particle directly to a placeholder; attach it to a fixed word instead ("{name} 파일을 열 수 없습니다", "‘{name}’ 항목을 삭제할까요?"). Counters follow the number: "{count}개", "{seconds}초".
- Slash command tokens (`command.token.*`) stay in English: dsh resolves typed commands only by their English or Chinese spelling.
- Keep untranslated: DeepSeek, DeepSeek Harness, dsh, DSH, Cordis, MCP, ACP, PTC, SSH, LSP, API, JSON, YAML, command and tool names, file names, code identifiers, keyboard keys and model names.
- Avoid translationese: no "~하는 것이 가능합니다", no "당신", no needless passives or "~에 대해".

## Terms

| English | Korean | Note |
| --- | --- | --- |
| agent | 에이전트 | |
| subagent | 서브에이전트 | Capitalized "Subagent" in English is the same term. |
| agent preset | 에이전트 프리셋 | "mode" in preset names is 모드 (표준 모드, PTC 모드). |
| session | 세션 | |
| conversation | 대화 | |
| side chat | 사이드 채팅 | A separate conversation tab that inherits the main session context. |
| main (agent, conversation, session, computer) | 메인 | 메인 에이전트, 메인 대화, 메인 세션, 메인 컴퓨터. Not 주 or 기본 (기본 means default). "Main menu" stays 주 메뉴; Git "main checkout" stays 기본 체크아웃. |
| thinking | 생각 | Model thinking labels: 생각, 생각 중…. Reasoning (effort, tokens) stays 추론. |
| filter (verb) | 필터링 | Placeholders: "경로로 필터링…". The noun filter is 필터. |
| state labels | ~ 안 됨, ~됨 | 저장 안 됨, 연결 안 됨, 설치 안 됨, 설치됨, 복사됨, 저장됨, 고정됨, 삭제됨. Not 저장하지 않음 or 복사함 for states. |
| window (loaded/served message range) | 범위 | 불러온 범위 밖. The context window is 컨텍스트 창; its free part is 남은 컨텍스트. |
| follow-up (session, thread) | 후속 | 후속 세션, 후속 대화 스레드. The action "Ask a follow-up" stays 이어서 묻기. |
| turn | 턴 | One user request and the agent's work on it. |
| step | 단계 | |
| message | 메시지 | |
| workspace | 워크스페이스 | Shorter than 작업 공간 and common in developer tools. |
| task | 작업 | |
| background job, job | 백그라운드 작업, 작업 | |
| tool, tool call | 도구, 도구 호출 | |
| plugin | 플러그인 | |
| model, provider | 모델, 공급자 | "model provider" is 모델 공급자. |
| token | 토큰 | "tok" stays as the unit. |
| context, context window | 컨텍스트, 컨텍스트 창 | |
| compact, compaction | 압축, 컨텍스트 압축 | |
| prompt, system prompt | 프롬프트, 시스템 프롬프트 | |
| reasoning, reasoning effort | 추론, 추론 강도 | |
| trajectory | 실행 기록 | The view of every model request and tool call in a session. |
| session log | 세션 로그 | |
| permission, approval | 권한, 승인 | |
| sandbox | 샌드박스 | |
| preset | 프리셋 | |
| goal | 목표 | |
| plan, plan mode | 계획, 계획 모드 | |
| to-do list | 할 일 목록 | |
| reminder, schedule | 알림, 예약 | Scheduled automation tasks are 자동화 작업. |
| queue, steer | 대기열, 즉시 전달 | Sending while the agent runs: queue the message for the next turn, or deliver it into the current run. |
| branch, fork (a session) | 분기 | Both start a new session from a completed turn. |
| attachment | 첨부 파일 | |
| preview | 미리보기 | Previews of documents, files and pages. |
| Preview (release stage) | 프리뷰 | dsh 0.2 being a preview release; keeps it apart from 미리보기. |
| sidebar | 사이드바 | |
| terminal, shell | 터미널, 셸 | |
| registry, package | 레지스트리, 패키지 | |
| install, uninstall | 설치, 제거 | |
| enable, disable | 사용, 사용 안 함 | Same words as state tags. |
| deployment | 배포 환경 | The dsh installation serving this UI. |
| credits, balance, top up | 크레딧, 잔액, 충전 | |
| sign in, sign out | 로그인, 로그아웃 | |
| retry, try again | 다시 시도 | |
| inspect | 검사 | |
| skill | 스킬 | |
| feedback | 피드백 | |
| built-in, custom | 기본 제공, 사용자 지정 | |
| Standard / Minimal / PTC / Creator mode | 표준 모드, 최소 모드, PTC 모드, 크리에이터 모드 | Built-in agent preset names. |
| Full access, Read Only, Workspace Write | 전체 접근, 읽기 전용, 워크스페이스 쓰기 | Permission presets. |
| overridden | 변경됨 | A setting that differs from its default. |
| base URL, endpoint | 기본 URL, 엔드포인트 | |
| credential | 자격 증명 | |
| component (of a plugin) | 구성 요소 | |
| bundle, profile | 번들, 프로필 | |
| Auto review | 자동 검토 | Permission mode with model review before each call. |
| native (tool call) | 네이티브 | Kept apart from 기본 제공 (built-in). |
| shortcut, modifier key | 단축키, 보조 키 | |
| archive, pin | 보관, 고정 | |
| pane, split | 분할 창, 나누기 | Right sidebar layout; 창 alone means a window. |
| delivery record | 전달 기록 | What an automation task sent to its session. |
| deliverables, present files | 결과물, 파일 전달 | Files the agent hands back at the end of a turn. |
| one-shot, continuable (subagent) | 일회성, 이어서 진행 가능 | |
| time zone | 시간대 | |
| render (a preview) | 렌더링 | Loading text such as "문서 렌더링 중...". |
| experimental feature | 실험 기능 | Plugin badges and categories; the bare badge "Experimental" is 실험. |
| migration | 마이그레이션 | Moving a session to a newer format; "Migration required" is 마이그레이션 필요. |
| raw data, raw log | 원시 데이터, 원시 로그 | The unformatted session records a log view shows. |
| record (in a session log) | 레코드 | One row of the session log table; "no records" is 기록 없음. |
| font, font size | 글꼴, 글자 크기 | 글꼴 names a family list, 글자 크기 a px size (코드 글꼴, 본문 글꼴, 터미널 글꼴). |
| source (of a plugin) | 소스 | Code source is 코드 소스; "built in" is 기본 제공. |
| update (action) | 업데이트 | Plugin state labels: 업데이트 있음 (available), 설치 안 됨 (not installed). |
| suggestion (in a filter) | 제안 | Keyword completion in the session log filter. |
| inspector (panel) | 검사기 | NodeJS 검사기; not 인스펙터. |
| command line, command arguments | 명령줄, 명령 인수 | |
| translation service | 번역 서비스 | The external provider translation features send text to. |
| target language | 대상 언어 | The language a translation produces. |
| input device | 입력 장치 | Microphone pickers; 시스템 기본값 is the system default. |
| external task (subagent) | 외부 작업 | A subagent that runs outside this session. |

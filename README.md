# dsh-locale-ko

DeepSeek Harness(dsh)의 웹 화면과 데스크톱 앱을 한국어로 바꾸는 언어팩(language pack) 플러그인입니다. 설치하면 설정의 언어 목록에 '한국어'가 추가됩니다. 메뉴와 버튼, 안내 문구, 오류 메시지가 한국어로 표시됩니다.

dsh 0.2.0-rc.2에서 확인했습니다.

## 설치

웹 화면(`dsh web`)과 데스크톱 앱(DeepSeek Harness.app)은 같은 화면을 쓰므로 언어팩도 똑같이 적용됩니다. 쓰는 쪽에 맞춰 설치하세요.

### 웹 화면(dsh web)

```sh
npx @deepseek-ai/dsh plugin --profile web add dsh-locale-ko
```

설치한 다음 `npx @deepseek-ai/dsh web`으로 웹 화면을 다시 시작합니다.

### 데스크톱 앱

언어팩을 설치하기 전에는 화면이 영어이므로 괄호 안의 영어 이름을 찾으면 됩니다.

1. 왼쪽 사이드바에서 **플러그인**(Plugins)을 엽니다.
2. **플러그인 추가**(Add plugin)를 누릅니다.
3. **플러그인 추가**(Add plugin) 창의 입력 칸(흐린 글씨로 `for example dsh-plugin-whale-pet`이 보이는 칸)에 패키지 이름 `dsh-locale-ko`만 입력하고 **설치**(Install)를 누릅니다. `dsh plugin ...`으로 시작하는 명령 전체를 붙여 넣으면 "not a package name" 오류가 납니다.
4. 화면에서 설치한 플러그인은 꺼진 상태로 설치됩니다. 설치가 끝나면 **지금 사용**(Enable now)을 눌러 켭니다. 다시 시작하라는 안내가 나오면 앱을 다시 시작합니다.

명령줄로 설치할 수도 있습니다. 이때는 앱에 들어 있는 `dsh` 명령을 씁니다.

1. 앱 메뉴 **DeepSeek Harness > Manage dsh Command…**에서 `dsh` 명령을 등록합니다.
2. 앱을 완전히 종료합니다.
3. 새 터미널 창에서 다음 명령을 실행합니다.

   ```sh
   dsh plugin --profile desktop add dsh-locale-ko
   ```

4. 앱을 다시 엽니다.

## 언어 선택

시스템이나 브라우저 언어가 한국어라면 따로 고르지 않아도 한국어로 바뀝니다. 데스크톱 앱은 macOS 언어를 따르고 웹 화면은 처음 열 때 브라우저 언어를 따릅니다.

자동으로 바뀌지 않았다면 **설정 > 일반 > 언어**(Settings > General > Language)에서 **한국어**를 고르세요. 그 전까지는 화면이 영어로 나옵니다.

## 번역되지 않는 부분

- dsh 새 버전에서 추가된 문구와 다른 플러그인이 넣은 문구는 번역하기 전까지 영어로 나옵니다.
- 직접 켜야 하는 실험 기능(음성 입력, 에이전트 팀 등)의 화면은 번역 대상이 아니라서 영어로 나옵니다.
- 데스크톱 앱의 macOS 메뉴 막대, 시작 창, 업데이트 대화 상자는 앱이 영어와 중국어만 지원해서 언어팩으로 바뀌지 않습니다.

## 번역 오류 제보

어색하거나 틀린 번역을 발견하면 [GitHub 이슈](https://github.com/juliankang4/dsh-locale-ko/issues)에 알려 주세요. 화면 위치와 원래 영어 문구를 함께 적어 주시면 고치기 쉽습니다. 용어는 [GLOSSARY.md](GLOSSARY.md)를 기준으로 맞춥니다.

## 라이선스

MIT

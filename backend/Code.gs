// ============================================================
// ChatAlarm – Google Apps Script Backend  v2.1
// Google Chat 자동 알림 예약 발송 시스템
// ============================================================
//
// [설치 방법]
//  1. 이 파일 전체를 GAS 편집기에 붙여넣기 후 저장(Ctrl+S)
//  2. 편집기 상단 함수 선택란에서 [installTrigger] 를 선택 후 실행(▶)
//     → 1분 주기 트리거가 자동 등록됩니다 (기존 트리거 중복 방지)
//  3. [배포] → [배포 관리] → [새 버전 생성] 후 배포 완료
// ============================================================

// ── Sheet names ─────────────────────────────────────────────
var SHEETS = {
  USERS:     'Users',
  WEBHOOKS:  'Webhooks',
  SCHEDULES: 'Schedules',
  LOGS:      'Logs',
};

// ── Spreadsheet ID helper ────────────────────────────────────
function getSpreadsheetId() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active.getId();
  } catch(e) {}
  var prop = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (prop) return prop;
  throw new Error('Spreadsheet ID를 찾을 수 없습니다. 스크립트 속성에 SPREADSHEET_ID를 설정하거나 시트 연결 스크립트로 사용하세요.');
}

// ── 트리거 자동 설치 (1분 주기) ─────────────────────────────
// GAS 편집기에서 [installTrigger] 함수를 한 번 실행하면 됩니다.
function installTrigger() {
  // 기존에 등록된 sendScheduledMessages 트리거 모두 제거 (중복 방지)
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendScheduledMessages') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // 1분 주기 트리거 새로 등록
  ScriptApp.newTrigger('sendScheduledMessages')
    .timeBased()
    .everyMinutes(1)
    .create();
  Logger.log('✅ 트리거 설치 완료: sendScheduledMessages (1분 주기)');
}

// ── CORS / entry point ──────────────────────────────────────

function doGet(e) {
  if (!e || !e.parameter) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: '웹 앱 URL로 호출해 주세요. 편집기 실행 버튼은 지원되지 않습니다.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var params   = e.parameter;
  var callback = params.callback;
  var action   = params.action;
  var data     = {};
  try { data = JSON.parse(params.data || '{}'); } catch(ex) {}

  var result = handleAction(action, data);

  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(result) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var params = JSON.parse(e.postData.contents || '{}');
  var result = handleAction(params.action, params.data || {});
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Router ──────────────────────────────────────────────────

function handleAction(action, data) {
  try {
    switch (action) {
      case 'register':       return registerUser(data);
      case 'login':          return loginUser(data);
      case 'getWebhooks':    return getWebhooks(data);
      case 'addWebhook':     return addWebhook(data);
      case 'updateWebhook':  return updateWebhook(data);
      case 'deleteWebhook':  return deleteWebhook(data);
      case 'testWebhook':    return testWebhook(data);
      case 'getSchedules':   return getSchedules(data);
      case 'addSchedule':    return addSchedule(data);
      case 'updateSchedule': return updateSchedule(data);
      case 'deleteSchedule': return deleteSchedule(data);
      default: return { success: false, message: '알 수 없는 action: ' + action };
    }
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

// ── Sheet helpers ────────────────────────────────────────────

function getSheet(name) {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    initSheet(sh, name);
  }
  return sh;
}

function initSheet(sh, name) {
  var headers = {
    Users:     [['id','name','team','pin','createdAt']],
    Webhooks:  [['id','userId','label','url','createdAt']],
    Schedules: [['id','userId','name','days','time','message','webhookId','excludedDates','active','createdAt']],
    Logs:      [['id','scheduleId','sentAt','status','detail']],
  };
  if (headers[name]) sh.getRange(1,1,1,headers[name][0].length).setValues(headers[name]);
}

function sheetData(sh) {
  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return { headers: vals[0] || [], rows: [] };
  return { headers: vals[0], rows: vals.slice(1) };
}

function rowToObj(headers, row) {
  var obj = {};
  headers.forEach(function(h, i) { obj[h] = row[i]; });
  return obj;
}

function newId() {
  return Utilities.getUuid();
}

// ── Users ────────────────────────────────────────────────────

function registerUser(data) {
  var sh = getSheet(SHEETS.USERS);
  var { headers, rows } = sheetData(sh);
  var nameIdx = headers.indexOf('name');
  var teamIdx = headers.indexOf('team');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][nameIdx] === data.name && rows[i][teamIdx] === data.team) {
      return { success: false, message: '이미 등록된 이름+팀 조합입니다.' };
    }
  }
  var id = newId();
  sh.appendRow([id, data.name, data.team, data.pin, new Date().toISOString()]);
  return { success: true, id: id };
}

function loginUser(data) {
  var sh = getSheet(SHEETS.USERS);
  var { headers, rows } = sheetData(sh);
  for (var i = 0; i < rows.length; i++) {
    var row = rowToObj(headers, rows[i]);
    if (row.name === data.name && row.team === data.team && String(row.pin) === String(data.pin)) {
      return { success: true, id: row.id, name: row.name, team: row.team };
    }
  }
  return { success: false, message: '이름, 팀명 또는 비밀번호가 일치하지 않습니다.' };
}

// ── Webhooks ─────────────────────────────────────────────────

function getWebhooks(data) {
  var sh = getSheet(SHEETS.WEBHOOKS);
  var { headers, rows } = sheetData(sh);
  var userIdx = headers.indexOf('userId');
  var result = rows
    .filter(function(r) { return r[userIdx] === data.userId; })
    .map(function(r) { return rowToObj(headers, r); });
  return { success: true, data: result };
}

function addWebhook(data) {
  var sh = getSheet(SHEETS.WEBHOOKS);
  var id = newId();
  sh.appendRow([id, data.userId, data.label, data.url, new Date().toISOString()]);
  return { success: true, id: id };
}

function updateWebhook(data) {
  var sh = getSheet(SHEETS.WEBHOOKS);
  var { headers, rows } = sheetData(sh);
  var idIdx    = headers.indexOf('id');
  var labelIdx = headers.indexOf('label');
  var urlIdx   = headers.indexOf('url');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][idIdx] === data.webhookId) {
      sh.getRange(i + 2, labelIdx + 1).setValue(data.label);
      sh.getRange(i + 2, urlIdx + 1).setValue(data.url);
      return { success: true };
    }
  }
  return { success: false, message: 'Webhook을 찾을 수 없습니다.' };
}

function deleteWebhook(data) {
  var sh = getSheet(SHEETS.WEBHOOKS);
  var { headers, rows } = sheetData(sh);
  var idIdx = headers.indexOf('id');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][idIdx] === data.webhookId) {
      sh.deleteRow(i + 2);
      return { success: true };
    }
  }
  return { success: false, message: 'Webhook을 찾을 수 없습니다.' };
}

// ── Schedules ─────────────────────────────────────────────────

function getSchedules(data) {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var tz = ss.getSpreadsheetTimeZone();
  var sh = ss.getSheetByName(SHEETS.SCHEDULES);
  if (!sh) return { success: true, data: [] };

  var { headers, rows } = sheetData(sh);
  var userIdx = headers.indexOf('userId');
  var result = rows
    .filter(function(r) { return r[userIdx] === data.userId; })
    .map(function(r) {
      var obj = rowToObj(headers, r);
      try { obj.days = JSON.parse(obj.days); } catch(e) { obj.days = []; }
      try { obj.excludedDates = JSON.parse(obj.excludedDates); } catch(e) { obj.excludedDates = []; }
      obj.active = obj.active !== false && obj.active !== 'false';
      // 프론트엔드로 전달하기 전에 HH:mm 형식으로 정규화 (시간대 왜곡 방지)
      obj.time = formatTimeValueToHHMM(obj.time, tz);
      return obj;
    });
  return { success: true, data: result };
}

function addSchedule(data) {
  var sh = getSheet(SHEETS.SCHEDULES);
  var id = newId();
  sh.appendRow([
    id, data.userId, data.name,
    JSON.stringify(data.days || []),
    data.time, data.message, data.webhookId,
    JSON.stringify(data.excludedDates || []),
    data.active !== false,
    new Date().toISOString()
  ]);
  return { success: true, id: id };
}

function updateSchedule(data) {
  var sh = getSheet(SHEETS.SCHEDULES);
  var { headers, rows } = sheetData(sh);
  var idIdx = headers.indexOf('id');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][idIdx] === data.scheduleId) {
      var rowNum = i + 2;
      var setVal = function(col, val) { sh.getRange(rowNum, headers.indexOf(col) + 1).setValue(val); };
      setVal('name',          data.name);
      setVal('days',          JSON.stringify(data.days || []));
      setVal('time',          data.time);
      setVal('message',       data.message);
      setVal('webhookId',     data.webhookId);
      setVal('excludedDates', JSON.stringify(data.excludedDates || []));
      setVal('active',        data.active !== false);
      return { success: true };
    }
  }
  return { success: false, message: '스케줄을 찾을 수 없습니다.' };
}

function deleteSchedule(data) {
  var sh = getSheet(SHEETS.SCHEDULES);
  var { headers, rows } = sheetData(sh);
  var idIdx = headers.indexOf('id');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][idIdx] === data.scheduleId) {
      sh.deleteRow(i + 2);
      return { success: true };
    }
  }
  return { success: false, message: '스케줄을 찾을 수 없습니다.' };
}

// ── 시간 포맷 헬퍼 ────────────────────────────────────────────
// 스프레드시트의 Date 객체, ISO 문자열, "HH:mm" 등 모든 형식을 "HH:mm"으로 정규화
function formatTimeValueToHHMM(val, tz) {
  if (!val) return '';
  var timezone = tz || 'Asia/Seoul';
  if (val instanceof Date) {
    return Utilities.formatDate(val, timezone, 'HH:mm');
  }
  var str = String(val).trim();
  // ISO 형식: "1899-12-30T00:27:00.000Z" 또는 일반 ISO
  if (str.indexOf('T') !== -1) {
    try {
      var d = new Date(str);
      if (!isNaN(d.getTime())) {
        return Utilities.formatDate(d, timezone, 'HH:mm');
      }
    } catch(e) {}
  }
  // "HH:mm" 또는 "HH:mm:ss"
  var match = str.match(/^(\d{2}):(\d{2})/);
  if (match) {
    return match[1] + ':' + match[2];
  }
  return str;
}

// ── KST 기준 오늘 날짜 문자열 "YYYY-MM-DD" 반환 ──────────────
function getKSTDateString(kstDate) {
  var year  = kstDate.getUTCFullYear();
  var month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  var date  = String(kstDate.getUTCDate()).padStart(2, '0');
  return year + '-' + month + '-' + date;
}

// ── Logs 시트의 sentAt 셀 값을 "YYYY-MM-DD" 문자열로 안전하게 추출 ──
// 스프레드시트가 Date 객체로 자동 변환해도 정상 동작
function extractDateFromSentAt(sentAtVal, tz) {
  if (!sentAtVal) return '';
  var timezone = tz || 'Asia/Seoul';
  if (sentAtVal instanceof Date) {
    // 스프레드시트가 Date 객체로 파싱한 경우
    return Utilities.formatDate(sentAtVal, timezone, 'yyyy-MM-dd');
  }
  var str = String(sentAtVal).trim();
  // "2026-05-20 11:27" 또는 "2026-05-20T11:27:00" 형식
  var match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  // 영문 Date 문자열: "Tue May 20 2026 11:27:00 GMT+0900"
  try {
    var d = new Date(str);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, timezone, 'yyyy-MM-dd');
    }
  } catch(e) {}
  return str.substring(0, 10);
}

// ── 예약 알림 발송 (1분 트리거로 자동 실행) ─────────────────
function sendScheduledMessages() {
  var now = new Date();

  // KST(UTC+9) 기준 시각 계산 (서버 로케일 무관하게 항상 KST)
  var kstMs   = now.getTime() + (9 * 60 * 60 * 1000);
  var kstDate = new Date(kstMs);

  var year   = kstDate.getUTCFullYear();
  var month  = kstDate.getUTCMonth();       // 0-indexed
  var date   = kstDate.getUTCDate();
  var hour   = kstDate.getUTCHours();
  var minute = kstDate.getUTCMinutes();
  var day    = kstDate.getUTCDay();         // 0=Sun,1=Mon,...,6=Sat

  var dayMap = { 0:'SUN', 1:'MON', 2:'TUE', 3:'WED', 4:'THU', 5:'FRI', 6:'SAT' };
  var todayCode = dayMap[day];

  var hh      = String(hour).padStart(2, '0');
  var mm      = String(minute).padStart(2, '0');
  var nowTime = hh + ':' + mm;
  var todayStr = getKSTDateString(kstDate);

  Logger.log('[sendScheduledMessages] KST 시각: ' + todayStr + ' ' + nowTime + ' (' + todayCode + ')');

  // 스프레드시트 및 시간대 획득
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var tz = ss.getSpreadsheetTimeZone();

  var sh    = ss.getSheetByName(SHEETS.SCHEDULES);
  var whSh  = ss.getSheetByName(SHEETS.WEBHOOKS);
  var logSh = ss.getSheetByName(SHEETS.LOGS);

  if (!sh || !whSh) {
    Logger.log('[sendScheduledMessages] Schedules 또는 Webhooks 시트 없음 → 종료');
    return;
  }

  var { headers, rows }       = sheetData(sh);
  var { headers: whH, rows: whRows } = sheetData(whSh);

  // 오늘 이미 성공적으로 발송된 스케줄 ID 세트 구성 (중복 발송 방지)
  var sentTodaySet = {};
  if (logSh) {
    var { headers: logH, rows: logRows } = sheetData(logSh);
    var scheduleIdIdx = logH.indexOf('scheduleId');
    var sentAtIdx     = logH.indexOf('sentAt');
    var statusIdx     = logH.indexOf('status');

    if (scheduleIdIdx !== -1 && sentAtIdx !== -1 && statusIdx !== -1) {
      logRows.forEach(function(r) {
        var sentDateStr = extractDateFromSentAt(r[sentAtIdx], tz); // "YYYY-MM-DD"
        var statusVal   = String(r[statusIdx]);
        var schedId     = String(r[scheduleIdIdx]);
        if (sentDateStr === todayStr && statusVal === 'OK') {
          sentTodaySet[schedId] = true;
        }
      });
    }
    Logger.log('[sendScheduledMessages] 오늘 발송 완료 스케줄 수: ' + Object.keys(sentTodaySet).length);
  }

  // 각 스케줄 순회 및 발송 판단
  rows.forEach(function(row) {
    var sc = rowToObj(headers, row);

    // 1) 비활성 스케줄 스킵
    if (sc.active === false || sc.active === 'false') return;

    // 2) 요일 파싱
    var days = [];
    if (Array.isArray(sc.days)) {
      days = sc.days;
    } else {
      try { days = JSON.parse(sc.days || '[]'); } catch(e) {
        if (typeof sc.days === 'string' && sc.days.trim()) {
          days = sc.days.split(',').map(function(s) { return s.trim(); });
        }
      }
    }

    // 3) 오늘 요일 포함 여부 확인
    if (days.indexOf(todayCode) === -1) return;

    // 4) 발송 제외일 확인
    var excludedDates = [];
    if (Array.isArray(sc.excludedDates)) {
      excludedDates = sc.excludedDates;
    } else {
      try { excludedDates = JSON.parse(sc.excludedDates || '[]'); } catch(e) {
        if (typeof sc.excludedDates === 'string' && sc.excludedDates.trim()) {
          excludedDates = sc.excludedDates.split(',').map(function(s) { return s.trim(); });
        }
      }
    }
    if (excludedDates.indexOf(todayStr) !== -1) {
      Logger.log('[skip] 제외일 스케줄: ' + sc.name);
      return;
    }

    // 5) 스케줄 시각을 "HH:mm"으로 정규화
    var formattedScheduleTime = formatTimeValueToHHMM(sc.time, tz);
    if (!formattedScheduleTime) {
      Logger.log('[skip] 시각 파싱 실패: ' + sc.name + ' / 원본 time=' + sc.time);
      return;
    }

    // 6) 현재 시각이 스케줄 시각 이후인지 확인 (>= 비교: 트리거 지연에도 발송 보장)
    if (nowTime < formattedScheduleTime) {
      Logger.log('[skip] 아직 시각 아님: ' + sc.name + ' (' + formattedScheduleTime + ' > ' + nowTime + ')');
      return;
    }

    // 7) 오늘 이미 성공 발송 여부 확인 (중복 방지)
    if (sentTodaySet[sc.id]) {
      Logger.log('[skip] 오늘 이미 발송: ' + sc.name);
      return;
    }

    // 8) 웹훅 URL 조회
    var whRow = null;
    for (var wi = 0; wi < whRows.length; wi++) {
      if (rowToObj(whH, whRows[wi]).id === sc.webhookId) {
        whRow = whRows[wi];
        break;
      }
    }
    if (!whRow) {
      Logger.log('[skip] 웹훅 없음: ' + sc.name + ' webhookId=' + sc.webhookId);
      return;
    }
    var wh = rowToObj(whH, whRow);

    // 9) Google Chat 메시지 발송
    Logger.log('[send] 발송 시작: ' + sc.name + ' → ' + wh.url.substring(0, 50) + '...');
    try {
      var payload = JSON.stringify({ text: sc.message });
      var resp = UrlFetchApp.fetch(wh.url, {
        method: 'post',
        contentType: 'application/json',
        payload: payload,
        muteHttpExceptions: true,
      });
      var code   = resp.getResponseCode();
      var body   = resp.getContentText().slice(0, 200);
      var status = (code === 200 || code === 201) ? 'OK' : 'FAIL';
      logSend(sc.id, todayStr + ' ' + nowTime, status, 'HTTP ' + code + ' ' + body);
      Logger.log('[send] 결과: ' + status + ' (HTTP ' + code + ') / ' + sc.name);
    } catch(e) {
      logSend(sc.id, todayStr + ' ' + nowTime, 'ERROR', e.toString());
      Logger.log('[send] 오류: ' + sc.name + ' / ' + e.toString());
    }
  });

  Logger.log('[sendScheduledMessages] 실행 완료');
}

function logSend(scheduleId, sentAt, status, detail) {
  var sh = getSheet(SHEETS.LOGS);
  sh.appendRow([newId(), scheduleId, sentAt, status, detail]);
}

// ── Webhook 연결 테스트 ──────────────────────────────────────

function testWebhook(data) {
  var url = data.url;
  if (!url || !url.startsWith('https://')) {
    return { success: false, message: '유효하지 않은 Webhook URL입니다.' };
  }
  try {
    var payload = JSON.stringify({ text: '💬 Google Chat Webhook 연결 테스트에 성공했습니다! (ChatAlarm 알림 예약 시스템)' });
    var resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: payload,
      muteHttpExceptions: true,
    });
    var code = resp.getResponseCode();
    var body = resp.getContentText();
    if (code === 200 || code === 201) {
      return { success: true, message: '테스트 메시지가 성공적으로 전송되었습니다.' };
    } else {
      return { success: false, message: '전송 실패 (HTTP ' + code + '): ' + body.slice(0, 150) };
    }
  } catch(e) {
    return { success: false, message: '연결 오류: ' + e.toString() };
  }
}

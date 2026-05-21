// ============================================================
// ChatAlarm – Google Apps Script Backend  v3.0
// Google Chat 자동 알림 예약 발송 시스템
// ============================================================
//
// ▶ 설치 방법 (최초 1회)
//   1. 이 파일 전체를 GAS 편집기에 붙여넣고 저장 (Ctrl+S)
//   2. [배포] → [배포 관리] → [새 버전 생성] 후 배포
//   3. 배포 완료 후 아무 API 호출(예: 로그인)을 하면
//      트리거가 자동으로 설치됩니다. 수동 설치 불필요!
//
// ▶ 트리거 자가치유 (Self-healing)
//   웹앱이 API 요청을 받을 때마다 트리거 존재 여부를 확인하고,
//   없으면 자동으로 재설치합니다. 새 배포 후에도 정상 동작.
// ============================================================

var SHEETS = {
  USERS:     'Users',
  WEBHOOKS:  'Webhooks',
  SCHEDULES: 'Schedules',
  LOGS:      'Logs',
};

// ── Spreadsheet ID ───────────────────────────────────────────
function getSpreadsheetId() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      var id = active.getId();
      // 백그라운드 트리거에서도 사용할 수 있도록 스크립트 속성에 자동 저장
      PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);
      return id;
    }
  } catch(e) {}
  var prop = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (prop) return prop;
  throw new Error('Spreadsheet ID를 찾을 수 없습니다.');
}

// ── 트리거 자가치유 (Self-healing Trigger) ────────────────────
// API 요청마다 호출. 1시간마다 한 번씩 트리거 상태 확인.
// 트리거가 없으면 자동으로 재설치 → 새 배포 후에도 동작 보장.
function autoEnsureTrigger() {
  try {
    var props = PropertiesService.getScriptProperties();
    var lastCheck = props.getProperty('TRIGGER_CHECK_TS');
    var now = Date.now();
    // 1시간(3600000ms) 이내에 이미 확인했으면 스킵
    if (lastCheck && (now - Number(lastCheck)) < 3600000) return;

    var triggers = ScriptApp.getProjectTriggers();
    var found = false;
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'sendScheduledMessages') {
        found = true;
        break;
      }
    }
    if (!found) {
      ScriptApp.newTrigger('sendScheduledMessages')
        .timeBased()
        .everyMinutes(1)
        .create();
      Logger.log('[autoEnsureTrigger] ✅ 트리거 자동 설치 완료');
    } else {
      Logger.log('[autoEnsureTrigger] 트리거 정상 (기존 트리거 유지)');
    }
    props.setProperty('TRIGGER_CHECK_TS', String(now));
  } catch(e) {
    Logger.log('[autoEnsureTrigger] 오류 (무시됨): ' + e.toString());
  }
}

// 수동 설치용 (필요 시 GAS 편집기에서 직접 실행)
function installTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendScheduledMessages') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('sendScheduledMessages')
    .timeBased()
    .everyMinutes(1)
    .create();
  // 캐시 초기화 (다음 autoEnsureTrigger 호출 시 재확인)
  PropertiesService.getScriptProperties().deleteProperty('TRIGGER_CHECK_TS');
  Logger.log('✅ 트리거 설치 완료: sendScheduledMessages (1분 주기)');
}

// ── CORS / entry point ───────────────────────────────────────
function doGet(e) {
  if (!e || !e.parameter) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: '웹 앱 URL로 호출해 주세요.' }))
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

// ── Router ───────────────────────────────────────────────────
function handleAction(action, data) {
  // 모든 API 요청 시 트리거 상태 자동 확인 및 복구
  autoEnsureTrigger();

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
      case 'getLogs':        return getLogs(data);
      case 'getStatus':      return getStatus(data);
      case 'triggerSend':    sendScheduledMessages(); return { success: true };
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
  if (headers[name]) {
    sh.getRange(1,1,1,headers[name][0].length).setValues(headers[name]);
    if (name === SHEETS.USERS) {
      try {
        sh.getRange('D:D').setNumberFormat('@');
      } catch(e) {}
    }
  }
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

// ── 암호화 / 복호화 헬퍼 (Simple Reversible Encryption) ────────────────
var SECRET_KEY = 'chatalarm_secret_key_2026';

function encryptPin(pin) {
  if (!pin) return '';
  var pinStr = String(pin);
  var encrypted = '';
  for (var i = 0; i < pinStr.length; i++) {
    var charCode = pinStr.charCodeAt(i);
    var keyChar = SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
    var xor = charCode ^ keyChar;
    encrypted += ('0' + xor.toString(16)).slice(-2);
  }
  return 'ENC_' + encrypted;
}

function decryptPin(encPin) {
  if (!encPin) return '';
  var str = String(encPin);
  if (str.indexOf('ENC_') !== 0) return str; // support plain texts
  var hex = str.substring(4);
  var decrypted = '';
  for (var i = 0; i < hex.length; i += 2) {
    var hexPair = hex.substring(i, i + 2);
    var charCode = parseInt(hexPair, 16);
    var keyChar = SECRET_KEY.charCodeAt((i / 2) % SECRET_KEY.length);
    decrypted += String.fromCharCode(charCode ^ keyChar);
  }
  return decrypted;
}

function padPin(pin) {
  var str = String(pin).trim();
  if (/^\d{1,3}$/.test(str)) {
    return str.padStart(4, '0');
  }
  return str;
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
  try {
    sh.getRange('D:D').setNumberFormat('@');
  } catch(e) {}
  var encryptedPin = encryptPin(data.pin);
  var nextRow = sh.getLastRow() + 1;
  sh.appendRow([id, data.name, data.team, encryptedPin, new Date().toISOString()]);
  try {
    sh.getRange(nextRow, 4).setNumberFormat('@');
  } catch(e) {}
  return { success: true, id: id };
}

function loginUser(data) {
  var sh = getSheet(SHEETS.USERS);
  var { headers, rows } = sheetData(sh);
  for (var i = 0; i < rows.length; i++) {
    var row = rowToObj(headers, rows[i]);
    var storedPin = padPin(decryptPin(row.pin));
    if (row.name === data.name && row.team === data.team && String(storedPin) === String(data.pin)) {
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
  if (ss.getSpreadsheetTimeZone() !== 'Asia/Seoul') {
    try { ss.setSpreadsheetTimeZone('Asia/Seoul'); } catch(e) {}
  }
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
      setVal('createdAt',     new Date().toISOString());
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

// ── 발송 이력 조회 ────────────────────────────────────────────
function getLogs(data) {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var logSh = ss.getSheetByName(SHEETS.LOGS);
  if (!logSh) return { success: true, data: [] };

  var scSh = ss.getSheetByName(SHEETS.SCHEDULES);
  var scheduleNameMap = {};
  if (scSh) {
    var { headers: scH, rows: scRows } = sheetData(scSh);
    scRows.forEach(function(r) {
      var sc = rowToObj(scH, r);
      scheduleNameMap[sc.id] = sc.name || sc.id;
    });
  }

  var { headers, rows } = sheetData(logSh);
  // 최신 순 정렬 (최대 30건)
  var recent = rows.slice().reverse().slice(0, 30);
  var result = recent.map(function(r) {
    var obj = rowToObj(headers, r);
    var sentAtVal = obj.sentAt;
    if (sentAtVal instanceof Date) {
      var tz = ss.getSpreadsheetTimeZone();
      obj.sentAt = Utilities.formatDate(sentAtVal, tz, 'yyyy-MM-dd HH:mm');
    } else {
      obj.sentAt = String(sentAtVal || '').substring(0, 16);
    }
    obj.scheduleName = scheduleNameMap[obj.scheduleId] || obj.scheduleId;
    return obj;
  });
  return { success: true, data: result };
}

// ── 시스템 상태 확인 ──────────────────────────────────────────
function getStatus(data) {
  var triggerCount = 0;
  try {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'sendScheduledMessages') triggerCount++;
    }
  } catch(e) {}

  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  if (ss.getSpreadsheetTimeZone() !== 'Asia/Seoul') {
    try { ss.setSpreadsheetTimeZone('Asia/Seoul'); } catch(e) {}
  }
  var tz = ss.getSpreadsheetTimeZone();

  // 오늘 발송 이력 요약
  var logSh = ss.getSheetByName(SHEETS.LOGS);
  var todayCount  = 0;
  var todayOk     = 0;
  var todayFail   = 0;
  var kstMs    = Date.now() + 9 * 3600000;
  var kstDate  = new Date(kstMs);
  var todayStr = kstDate.getUTCFullYear() + '-' +
    String(kstDate.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(kstDate.getUTCDate()).padStart(2, '0');

  if (logSh) {
    var { headers: lh, rows: lr } = sheetData(logSh);
    var sentAtIdx = lh.indexOf('sentAt');
    var statusIdx = lh.indexOf('status');
    lr.forEach(function(r) {
      var sentAtRaw = r[sentAtIdx];
      var sentDateStr = '';
      if (sentAtRaw instanceof Date) {
        sentDateStr = Utilities.formatDate(sentAtRaw, tz, 'yyyy-MM-dd');
      } else {
        var m = String(sentAtRaw).match(/^(\d{4}-\d{2}-\d{2})/);
        sentDateStr = m ? m[1] : '';
      }
      if (sentDateStr === todayStr) {
        todayCount++;
        if (String(r[statusIdx]) === 'OK') todayOk++;
        else todayFail++;
      }
    });
  }

  return {
    success:      true,
    triggerActive: triggerCount > 0,
    triggerCount:  triggerCount,
    today:         todayStr,
    todaySent:     todayCount,
    todayOk:       todayOk,
    todayFail:     todayFail,
    timezone:      tz,
  };
}

// ── 시간 포맷 헬퍼 ────────────────────────────────────────────
function formatTimeValueToHHMM(val, tz) {
  if (!val) return '';
  var timezone = tz || 'Asia/Seoul';
  if (val instanceof Date) {
    return Utilities.formatDate(val, timezone, 'HH:mm');
  }
  var str = String(val).trim();
  if (str.indexOf('T') !== -1) {
    try {
      var d = new Date(str);
      if (!isNaN(d.getTime())) return Utilities.formatDate(d, timezone, 'HH:mm');
    } catch(e) {}
  }
  var match = str.match(/^(\d{2}):(\d{2})/);
  if (match) return match[1] + ':' + match[2];
  return str;
}

// ── KST 날짜 문자열 추출 ──────────────────────────────────────
function extractDateFromSentAt(sentAtVal, tz) {
  if (!sentAtVal) return '';
  var timezone = tz || 'Asia/Seoul';
  if (sentAtVal instanceof Date) {
    return Utilities.formatDate(sentAtVal, timezone, 'yyyy-MM-dd');
  }
  var str = String(sentAtVal).trim();
  var m = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  try {
    var d = new Date(str);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, timezone, 'yyyy-MM-dd');
  } catch(e) {}
  return str.substring(0, 10);
}

// ── 예약 알림 발송 (1분 트리거로 실행) ──────────────────────
function sendScheduledMessages() {
  var now     = new Date();
  var kstMs   = now.getTime() + 9 * 3600000;
  var kstDate = new Date(kstMs);

  var year   = kstDate.getUTCFullYear();
  var month  = kstDate.getUTCMonth();
  var date   = kstDate.getUTCDate();
  var hour   = kstDate.getUTCHours();
  var minute = kstDate.getUTCMinutes();
  var day    = kstDate.getUTCDay();

  var dayMap    = { 0:'SUN', 1:'MON', 2:'TUE', 3:'WED', 4:'THU', 5:'FRI', 6:'SAT' };
  var todayCode = dayMap[day];
  var nowTime   = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
  var todayStr  = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(date).padStart(2, '0');

  Logger.log('[Trigger] KST=' + todayStr + ' ' + nowTime + ' (' + todayCode + ')');

  var ss  = SpreadsheetApp.openById(getSpreadsheetId());
  if (ss.getSpreadsheetTimeZone() !== 'Asia/Seoul') {
    try {
      ss.setSpreadsheetTimeZone('Asia/Seoul');
    } catch(e) {
      Logger.log('[Trigger] Timezone alignment failed: ' + e.toString());
    }
  }
  var tz  = ss.getSpreadsheetTimeZone();
  var sh  = ss.getSheetByName(SHEETS.SCHEDULES);
  var wSh = ss.getSheetByName(SHEETS.WEBHOOKS);
  var lSh = ss.getSheetByName(SHEETS.LOGS);

  if (!sh || !wSh) {
    Logger.log('[Trigger] Schedules/Webhooks 시트 없음 → 종료');
    return;
  }

  var { headers, rows }            = sheetData(sh);
  var { headers: whH, rows: whRows } = sheetData(wSh);

  // 오늘 이미 OK로 발송된 스케줄 ID + 예정시각 키 맵
  var sentTodayMap = {};
  if (lSh) {
    var { headers: lh, rows: lr } = sheetData(lSh);
    var sidIdx    = lh.indexOf('scheduleId');
    var satIdx    = lh.indexOf('sentAt');
    var stIdx     = lh.indexOf('status');
    var dtIdx     = lh.indexOf('detail');
    if (sidIdx !== -1 && satIdx !== -1 && stIdx !== -1 && dtIdx !== -1) {
      lr.forEach(function(r) {
        var d = extractDateFromSentAt(r[satIdx], tz);
        if (d === todayStr && String(r[stIdx]) === 'OK') {
          var sId = String(r[sidIdx]);
          var detailStr = String(r[dtIdx]);
          // detail에 [Time: HH:mm]이 있는지 매칭
          var m = detailStr.match(/\[Time:\s*(\d{2}:\d{2})\]/);
          var loggedTime = '';
          if (m) {
            loggedTime = m[1];
          } else {
            // 하위 호환성: 기존 로그에 [Time: ...]이 없는 경우, sentAt의 시간 부분을 사용
            if (r[satIdx] instanceof Date) {
              loggedTime = Utilities.formatDate(r[satIdx], tz, 'HH:mm');
            } else {
              var tMatch = String(r[satIdx]).match(/(\d{2}):(\d{2})/);
              if (tMatch) {
                loggedTime = tMatch[1] + ':' + tMatch[2];
              }
            }
          }
          if (loggedTime) {
            sentTodayMap[sId + '_' + loggedTime] = true;
          } else {
            // 정말 파싱할 수 없는 경우에만 보수적으로 오늘 발송된 것으로 간주
            sentTodayMap[sId] = true;
          }
        }
      });
    }
    Logger.log('[Trigger] 오늘 발송 완료 맵 크기=' + Object.keys(sentTodayMap).length);
  }

  rows.forEach(function(row) {
    var sc = rowToObj(headers, row);

    // 1) 비활성
    if (sc.active === false || sc.active === 'false') return;

    // 2) 요일 파싱
    var days = [];
    if (Array.isArray(sc.days)) {
      days = sc.days;
    } else {
      try { days = JSON.parse(sc.days || '[]'); } catch(e) {
        if (typeof sc.days === 'string') days = sc.days.split(',').map(function(s) { return s.trim(); });
      }
    }
    if (days.indexOf(todayCode) === -1) return;

    // 3) 제외일
    var excl = [];
    if (Array.isArray(sc.excludedDates)) {
      excl = sc.excludedDates;
    } else {
      try { excl = JSON.parse(sc.excludedDates || '[]'); } catch(e) {
        if (typeof sc.excludedDates === 'string') excl = sc.excludedDates.split(',').map(function(s) { return s.trim(); });
      }
    }
    if (excl.indexOf(todayStr) !== -1) {
      Logger.log('[skip] 제외일: ' + sc.name);
      return;
    }

    // 4) 시각 비교
    var schedTime = formatTimeValueToHHMM(sc.time, tz);
    if (!schedTime) {
      Logger.log('[skip] 시각 파싱 불가: ' + sc.name);
      return;
    }
    if (nowTime < schedTime) {
      Logger.log('[skip] 아직 시각 아님: ' + sc.name + ' (' + schedTime + ')');
      return;
    }

    // 4.5) 금일 생성/수정 여부 및 시각 비교 (소급 발송 방지)
    if (sc.createdAt) {
      try {
        var createdMs = new Date(sc.createdAt).getTime() + 9 * 3600000;
        var createdKst = new Date(createdMs);
        var cYear   = createdKst.getUTCFullYear();
        var cMonth  = createdKst.getUTCMonth();
        var cDate   = createdKst.getUTCDate();
        var cHour   = createdKst.getUTCHours();
        var cMinute = createdKst.getUTCMinutes();
        
        var createdDateStr = cYear + '-' + String(cMonth + 1).padStart(2, '0') + '-' + String(cDate).padStart(2, '0');
        var createdTimeStr = String(cHour).padStart(2, '0') + ':' + String(cMinute).padStart(2, '0');

        if (createdDateStr === todayStr && createdTimeStr > schedTime) {
          Logger.log('[skip] 금일 생성/수정됨 (생성시간 ' + createdTimeStr + ' > 예약시간 ' + schedTime + '): ' + sc.name);
          return;
        }
      } catch(e) {
        Logger.log('[error] createdAt 파싱 실패 (스킵하지 않고 진행): ' + e.toString());
      }
    }

    // 5) 오늘 이미 발송됨
    if (sentTodayMap[sc.id] || sentTodayMap[sc.id + '_' + schedTime]) {
      Logger.log('[skip] 오늘 발송 완료: ' + sc.name + ' (scheduled: ' + schedTime + ')');
      return;
    }

    // 6) 웹훅 조회
    var wh = null;
    for (var i = 0; i < whRows.length; i++) {
      var w = rowToObj(whH, whRows[i]);
      if (w.id === sc.webhookId) { wh = w; break; }
    }
    if (!wh) {
      Logger.log('[skip] 웹훅 없음: ' + sc.name + ' (webhookId=' + sc.webhookId + ')');
      return;
    }

    // 7) 발송
    Logger.log('[send] ' + sc.name + ' → ' + wh.url.substring(0, 60) + '...');
    var logDetailPrefix = '[Time: ' + schedTime + '] ';
    try {
      var resp = UrlFetchApp.fetch(wh.url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ text: sc.message }),
        muteHttpExceptions: true,
      });
      var code   = resp.getResponseCode();
      var status = (code === 200 || code === 201) ? 'OK' : 'FAIL';
      logSend(sc.id, todayStr + ' ' + nowTime, status, logDetailPrefix + 'HTTP ' + code + ' ' + resp.getContentText().slice(0, 200));
      Logger.log('[send] ' + status + ' (HTTP ' + code + '): ' + sc.name);
    } catch(err) {
      logSend(sc.id, todayStr + ' ' + nowTime, 'ERROR', logDetailPrefix + err.toString());
      Logger.log('[send] ERROR: ' + sc.name + ' / ' + err.toString());
    }
  });
  Logger.log('[Trigger] 완료');
}

function logSend(scheduleId, sentAt, status, detail) {
  var sh = getSheet(SHEETS.LOGS);
  sh.appendRow([newId(), scheduleId, sentAt, status, detail]);
}

// ── Webhook 테스트 ─────────────────────────────────────────
function testWebhook(data) {
  var url = data.url;
  if (!url || !url.startsWith('https://')) {
    return { success: false, message: '유효하지 않은 Webhook URL입니다.' };
  }
  try {
    var resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ text: '💬 ChatAlarm 연결 테스트 성공! (강동어울림복지관 알림 예약 시스템)' }),
      muteHttpExceptions: true,
    });
    var code = resp.getResponseCode();
    if (code === 200 || code === 201) {
      return { success: true, message: '테스트 메시지가 성공적으로 전송되었습니다.' };
    }
    return { success: false, message: '전송 실패 (HTTP ' + code + '): ' + resp.getContentText().slice(0, 150) };
  } catch(e) {
    return { success: false, message: '연결 오류: ' + e.toString() };
  }
}

// ── Spreadsheet Custom Function for Administrator ───────────────────
/**
 * 암호화된 비밀번호를 복호화하여 평문으로 반환합니다.
 *
 * @param {string} encryptedPin 암호화된 비밀번호 (예: ENC_xxxx)
 * @return {string} 복호화된 4자리 평문 비밀번호
 * @customfunction
 */
function DECRYPT_PIN(encryptedPin) {
  if (!encryptedPin) return '';
  if (Array.isArray(encryptedPin)) {
    return encryptedPin.map(function(row) {
      return row.map(function(cell) {
        return padPin(decryptPin(cell));
      });
    });
  }
  return padPin(decryptPin(encryptedPin));
}

// ── Spreadsheet Custom Menu ──────────────────────────────────────────
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('ChatAlarm 관리')
      .addItem('🔑 선택한 셀 비밀번호 복호화/조회', 'decryptSelectedPin')
      .addToUi();
  } catch(e) {
    // 웹앱 API 컨텍스트 등 UI가 없는 환경에서의 호출 에러 방지
  }
}

function decryptSelectedPin() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    var range = sheet.getActiveRange();
    var values = range.getValues();
    var msg = '';
    var count = 0;
    
    for (var r = 0; r < values.length; r++) {
      for (var c = 0; c < values[r].length; c++) {
        var val = values[r][c];
        if (val) {
          var decrypted = padPin(decryptPin(val));
          var rowNum = range.getRow() + r;
          var colNum = range.getColumn() + c;
          
          var rowInfo = '';
          if (sheet.getName() === SHEETS.USERS && rowNum > 1) {
            var userName = sheet.getRange(rowNum, 2).getValue();
            var userTeam = sheet.getRange(rowNum, 3).getValue();
            if (userName) {
              rowInfo = ' (' + userName + ' / ' + userTeam + ')';
            }
          }
          
          msg += '행 ' + rowNum + ', 열 ' + colNum + rowInfo + ': [ ' + decrypted + ' ]\n';
          count++;
        }
      }
    }
    
    if (count > 0) {
      SpreadsheetApp.getUi().alert('🔑 [ChatAlarm] 비밀번호 복호화 결과\n\n' + msg);
    } else {
      SpreadsheetApp.getUi().alert('⚠️ 선택한 범위에 값이 비어 있습니다.');
    }
  } catch(e) {
    try {
      SpreadsheetApp.getUi().alert('오류 발생: ' + e.toString());
    } catch(err) {}
  }
}

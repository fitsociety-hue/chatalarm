// ============================================================
// ChatAlarm – Google Apps Script Backend
// Google Chat 자동 알림 예약 발송 시스템
// ============================================================

// Sheet names
var SHEETS = {
  USERS:     'Users',
  WEBHOOKS:  'Webhooks',
  SCHEDULES: 'Schedules',
  LOGS:      'Logs',
};

// ── Spreadsheet ID helper ──────────────────────────────────
// 바운드 스크립트(시트에 연결된 경우) 자동 감지, 독립 스크립트는
// 스크립트 속성 SPREADSHEET_ID 를 설정하거나 아래에 직접 입력하세요.
function getSpreadsheetId() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active.getId();
  } catch(e) {}
  var prop = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (prop) return prop;
  throw new Error('Spreadsheet ID를 찾을 수 없습니다. 스크립트 속성에 SPREADSHEET_ID를 설정하거나 시트 연결 스크립트로 사용하세요.');
}

// ── CORS / entry point ─────────────────────────────────────

function doGet(e) {
  // GAS 편집기 실행 버튼 직접 호출 시 e 가 undefined 일 수 있음
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
    // JSONP
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

// ── Router ─────────────────────────────────────────────────

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

// ── Sheet helpers ───────────────────────────────────────────

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

// ── Users ───────────────────────────────────────────────────

function registerUser(data) {
  var sh = getSheet(SHEETS.USERS);
  var { headers, rows } = sheetData(sh);
  // Check duplicate
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

// ── Webhooks ────────────────────────────────────────────────

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

// ── Schedules ───────────────────────────────────────────────

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
      
      // 프론트엔드로 전달하기 전에 안전하게 HH:mm 형식의 문자열로 변환하여 시각 왜곡 차단
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

// ── Scheduled trigger: send messages ────────────────────────
// Set a time-driven trigger: sendScheduledMessages every 1 minute

function formatTimeValueToHHMM(val, tz) {
  if (!val) return '';
  if (val instanceof Date) {
    // 스프레드시트 고유의 시간대를 사용하여 1899년 역사적 오프셋 불일치를 완벽히 예방
    var timezone = tz || 'GMT+09:00';
    return Utilities.formatDate(val, timezone, 'HH:mm');
  }
  var str = String(val).trim();
  // ISO 형식 확인 예: "1899-12-30T00:32:08.000Z"
  if (str.indexOf('T') !== -1) {
    try {
      var d = new Date(str);
      if (!isNaN(d.getTime())) {
        var timezone = tz || 'GMT+09:00';
        return Utilities.formatDate(d, timezone, 'HH:mm');
      }
    } catch(e) {}
  }
  // "HH:mm" 또는 "HH:mm:ss" 형식 확인
  var match = str.match(/^(\d{2}):(\d{2})/);
  if (match) {
    return match[1] + ':' + match[2];
  }
  return str;
}

function sendScheduledMessages() {
  var now  = new Date();
  
  // 1. KST(UTC+9) 기준의 정확한 밀리초 시각 계산 (실행 환경의 시간대/로캘 영향을 배제)
  var kstMs = now.getTime() + (9 * 60 * 60 * 1000);
  var kstDate = new Date(kstMs);
  
  var year = kstDate.getUTCFullYear();
  var month = kstDate.getUTCMonth(); // 0-indexed
  var date = kstDate.getUTCDate();
  var hour = kstDate.getUTCHours();
  var minute = kstDate.getUTCMinutes();
  var day  = kstDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  
  var dayMap = { 1:'MON', 2:'TUE', 3:'WED', 4:'THU', 5:'FRI', 6:'SAT', 0:'SUN' };
  var todayCode = dayMap[day];
  if (!todayCode) return; 

  var hh = String(hour).padStart(2, '0');
  var mm = String(minute).padStart(2, '0');
  var nowTime  = hh + ':' + mm;
  var todayStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(date).padStart(2, '0');

  // 스프레드시트 객체 및 고유 시간대 획득
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var tz = ss.getSpreadsheetTimeZone();

  var sh = ss.getSheetByName(SHEETS.SCHEDULES);
  var whSh = ss.getSheetByName(SHEETS.WEBHOOKS);
  var logSh = ss.getSheetByName(SHEETS.LOGS);
  
  if (!sh || !whSh) return;
  
  var { headers, rows } = sheetData(sh);
  var { headers: whH, rows: whRows } = sheetData(whSh);
  
  // 2. 오늘 이미 성공적으로 발송된 스케줄 ID 조회 (중복 전송 예방)
  var sentTodaySet = {};
  if (logSh) {
    var { headers: logH, rows: logRows } = sheetData(logSh);
    var scheduleIdIdx = logH.indexOf('scheduleId');
    var sentAtIdx = logH.indexOf('sentAt');
    var statusIdx = logH.indexOf('status');
    
    if (scheduleIdIdx !== -1 && sentAtIdx !== -1 && statusIdx !== -1) {
      logRows.forEach(function(r) {
        var sentAtVal = String(r[sentAtIdx]); // 예: "2026-05-20 11:05"
        var statusVal = String(r[statusIdx]);
        var schedId = String(r[scheduleIdIdx]);
        // 오늘 날짜로 시작하고 상태가 'OK'인 로그만 추출
        if (sentAtVal.indexOf(todayStr) === 0 && statusVal === 'OK') {
          sentTodaySet[schedId] = true;
        }
      });
    }
  }

  rows.forEach(function(row) {
    var sc = rowToObj(headers, row);
    if (sc.active === false || sc.active === 'false') return;

    var days = [];
    if (Array.isArray(sc.days)) {
      days = sc.days;
    } else {
      try { days = JSON.parse(sc.days || '[]'); } catch(e) {
        if (typeof sc.days === 'string') {
          days = sc.days.split(',').map(function(s) { return s.trim(); });
        }
      }
    }
    if (!days.includes(todayCode)) return;

    // 발송 제외일(excludedDates) 체크
    var excludedDates = [];
    if (Array.isArray(sc.excludedDates)) {
      excludedDates = sc.excludedDates;
    } else {
      try { excludedDates = JSON.parse(sc.excludedDates || '[]'); } catch(e) {
        if (typeof sc.excludedDates === 'string') {
          excludedDates = sc.excludedDates.split(',').map(function(s) { return s.trim(); });
        }
      }
    }
    if (excludedDates.indexOf(todayStr) !== -1) return;

    // 안전한 스프레드시트 시간대 기반 시간 비교
    var formattedScheduleTime = formatTimeValueToHHMM(sc.time, tz);
    
    // [개선] 스케줄 설정 시각이 아직 되지 않았다면 건너뜀
    if (nowTime < formattedScheduleTime) return;

    // [개선] 이미 오늘 성공적으로 발송된 이력이 있으면 중복 발송 예방을 위해 건너뜀
    if (sentTodaySet[sc.id]) return;

    // 웹훅 매칭 및 알림 발송
    var whRow = whRows.find(function(r) { return rowToObj(whH, r).id === sc.webhookId; });
    if (!whRow) return;
    var wh = rowToObj(whH, whRow);

    try {
      var payload = JSON.stringify({ text: sc.message });
      var resp = UrlFetchApp.fetch(wh.url, {
        method: 'post',
        contentType: 'application/json',
        payload: payload,
        muteHttpExceptions: true,
      });
      logSend(sc.id, todayStr + ' ' + nowTime, resp.getResponseCode() === 200 ? 'OK' : 'FAIL', resp.getContentText().slice(0, 200));
    } catch(e) {
      logSend(sc.id, todayStr + ' ' + nowTime, 'ERROR', e.toString());
    }
  });
}

function logSend(scheduleId, sentAt, status, detail) {
  var sh = getSheet(SHEETS.LOGS);
  sh.appendRow([newId(), scheduleId, sentAt, status, detail]);
}

function testWebhook(data) {
  var url = data.url;
  if (!url || !url.startsWith('https://')) {
    return { success: false, message: '유효하지 않은 Webhook URL입니다.' };
  }
  try {
    var payload = JSON.stringify({ text: '💬 Google Chat Webhook 연결 테스트에 성공했습니다! (강동어울림복지관 알림 예약 시스템)' });
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

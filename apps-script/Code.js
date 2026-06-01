const SCRIPT_PROPS = PropertiesService.getScriptProperties();
const SHEET_ID_KEY = 'PUMP_TRACKER_SHEET_ID';
const SHEET_SOURCES_KEY = 'PUMP_TRACKER_SHEET_SOURCES';
const ADMIN_PIN_KEY = 'PUMP_TRACKER_ADMIN_PIN';
const ADMIN_EMAILS_KEY = 'PUMP_TRACKER_ADMIN_EMAILS';
const GOOGLE_CLIENT_ID_KEY = 'PUMP_TRACKER_GOOGLE_CLIENT_ID';
const DEFAULT_ADMIN_PIN = 'admin123';
const DEFAULT_ADMIN_EMAILS = ['sushantkumar1995@gmail.com'];
const SHEET_NAME = 'Pumps';
const HEADERS = [
  'Pump ID',
  'Pump Model',
  'Serial No.',
  'Customer Name',
  'Site Location',
  'Contact Person',
  'Mobile No.',
  'Date Issued',
  'Sales Person',
  'Status',
  'Expected Return Date',
  'Remarks',
  'Photo URL',
  'Updated At',
];

function setup() {
  const spreadsheet = getSpreadsheet();
  const sheet = getPumpSheet(spreadsheet);
  seedIfEmpty(sheet);
  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    sheetName: SHEET_NAME,
  };
}

function doGet() {
  try {
    const spreadsheet = getSpreadsheet();
    const sheet = getPumpSheet(spreadsheet);
    seedIfEmpty(sheet);
    return jsonResponse({
      ok: true,
      spreadsheetId: spreadsheet.getId(),
      spreadsheetUrl: spreadsheet.getUrl(),
      records: readRecords(sheet),
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) }, 500);
  }
}

function doPost(event) {
  try {
    const body = JSON.parse(event.postData.contents || '{}');
    if (body.action === 'setSpreadsheet') {
      requireAdmin(body);
      const spreadsheet = setSpreadsheet(body.spreadsheetId || body.spreadsheetUrl);
      const sheet = getPumpSheet(spreadsheet);
      return jsonResponse({
        ok: true,
        spreadsheetId: spreadsheet.getId(),
        spreadsheetUrl: spreadsheet.getUrl(),
        sources: listSheetSources(),
        records: readRecords(sheet),
      });
    }

    if (body.action === 'createSpreadsheet') {
      requireAdmin(body);
      const spreadsheet = SpreadsheetApp.create(value(body.sheetName) || 'Pump Free-on-Loan Tracker Database');
      SCRIPT_PROPS.setProperty(SHEET_ID_KEY, spreadsheet.getId());
      const sheet = getPumpSheet(spreadsheet);
      rememberSheetSource(spreadsheet);
      return jsonResponse({
        ok: true,
        spreadsheetId: spreadsheet.getId(),
        spreadsheetUrl: spreadsheet.getUrl(),
        sources: listSheetSources(),
        records: readRecords(sheet),
      });
    }

    if (body.action === 'listSources') {
      requireAdmin(body);
      const spreadsheet = getSpreadsheet();
      return jsonResponse({
        ok: true,
        spreadsheetId: spreadsheet.getId(),
        spreadsheetUrl: spreadsheet.getUrl(),
        sources: listSheetSources(),
        records: readRecords(getPumpSheet(spreadsheet)),
      });
    }

    const spreadsheet = getSpreadsheet();
    const sheet = getPumpSheet(spreadsheet);
    seedIfEmpty(sheet);

    if (body.action === 'bulkReplace' && Array.isArray(body.records)) {
      requireAdmin(body);
      replaceRecords(sheet, body.records);
    } else if (body.action === 'delete' && body.id) {
      requireAdmin(body);
      deleteRecord(sheet, body.id);
    } else if (body.action === 'adminUpsert' && body.record) {
      requireAdmin(body);
      upsertRecord(sheet, body.record);
    } else if (body.action === 'updateStatus' && body.id) {
      updateStatus(sheet, body.id, body.status, body.remarks);
    } else if (body.action === 'updateAssignment' && body.id) {
      updateAssignment(sheet, body.id, body.fields || {});
    } else if (body.record) {
      upsertRecord(sheet, body.record);
    } else {
      throw new Error('Unsupported request body.');
    }

    return jsonResponse({
      ok: true,
      spreadsheetId: spreadsheet.getId(),
      spreadsheetUrl: spreadsheet.getUrl(),
      records: readRecords(sheet),
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) }, 400);
  }
}

function setSpreadsheet(input) {
  const spreadsheetId = parseSpreadsheetId(input);
  if (!spreadsheetId) throw new Error('Valid Google Sheet URL or ID is required.');
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  SCRIPT_PROPS.setProperty(SHEET_ID_KEY, spreadsheet.getId());
  rememberSheetSource(spreadsheet);
  return spreadsheet;
}

function parseSpreadsheetId(input) {
  const raw = value(input);
  if (!raw) return '';
  const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return raw;
}

function requireAdmin(body) {
  const configuredPin = SCRIPT_PROPS.getProperty(ADMIN_PIN_KEY) || DEFAULT_ADMIN_PIN;
  if (String(body.adminPin || '') === configuredPin) {
    return;
  }

  const admin = verifyGoogleAdmin(body.adminToken);
  if (!admin) {
    throw new Error('Admin Google login or PIN required for inventory changes.');
  }
}

function verifyGoogleAdmin(idToken) {
  if (!idToken) return null;
  const response = UrlFetchApp.fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) return null;

  const claims = JSON.parse(response.getContentText());
  if (claims.email_verified !== 'true' && claims.email_verified !== true) return null;

  const configuredClientId = value(SCRIPT_PROPS.getProperty(GOOGLE_CLIENT_ID_KEY));
  if (configuredClientId && claims.aud !== configuredClientId) return null;

  const allowedEmails = getAdminEmails();
  const email = value(claims.email).toLowerCase();
  return allowedEmails.includes(email) ? { email, name: value(claims.name) } : null;
}

function getAdminEmails() {
  const configured = value(SCRIPT_PROPS.getProperty(ADMIN_EMAILS_KEY));
  const emails = configured ? configured.split(',') : DEFAULT_ADMIN_EMAILS;
  return emails.map(item => value(item).toLowerCase()).filter(Boolean);
}

function getSpreadsheet() {
  const existingId = SCRIPT_PROPS.getProperty(SHEET_ID_KEY);
  if (existingId) {
    const spreadsheet = SpreadsheetApp.openById(existingId);
    rememberSheetSource(spreadsheet);
    return spreadsheet;
  }
  const spreadsheet = SpreadsheetApp.create('Pump Free-on-Loan Tracker Database');
  SCRIPT_PROPS.setProperty(SHEET_ID_KEY, spreadsheet.getId());
  rememberSheetSource(spreadsheet);
  return spreadsheet;
}

function listSheetSources() {
  const currentId = SCRIPT_PROPS.getProperty(SHEET_ID_KEY);
  return getSheetSources().map(source => ({
    ...source,
    isActive: source.id === currentId,
  }));
}

function getSheetSources() {
  try {
    const sources = JSON.parse(SCRIPT_PROPS.getProperty(SHEET_SOURCES_KEY) || '[]');
    return Array.isArray(sources) ? sources : [];
  } catch (error) {
    return [];
  }
}

function rememberSheetSource(spreadsheet) {
  const now = new Date().toISOString();
  const source = {
    id: spreadsheet.getId(),
    name: spreadsheet.getName(),
    url: spreadsheet.getUrl(),
    lastUsedAt: now,
  };
  const sources = getSheetSources();
  const index = sources.findIndex(item => item.id === source.id);
  if (index >= 0) {
    sources[index] = { ...sources[index], ...source };
  } else {
    sources.unshift({ ...source, createdAt: now });
  }
  SCRIPT_PROPS.setProperty(SHEET_SOURCES_KEY, JSON.stringify(sources.slice(0, 25)));
}

function getPumpSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeaders = HEADERS.some((header, index) => firstRow[index] !== header);
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function seedIfEmpty(sheet) {
  if (sheet.getLastRow() > 1) return;
  replaceRecords(sheet, [
    {
      id: 'PUMP-0001',
      model: 'TASKI DQFM Pump',
      serialNo: 'SN12345',
      customerName: 'ABC Facility',
      siteLocation: 'Gurgaon',
      contactPerson: 'Amit Kumar',
      mobileNo: '9876543210',
      dateIssued: '2026-05-30',
      salesPerson: 'Prashant',
      status: 'Active',
      expectedReturnDate: '2027-05-30',
      remarks: 'Free on loan for facility trial.',
      photoUrl: '',
      updatedAt: '2026-05-30',
    },
    {
      id: 'PUMP-0002',
      model: 'TASKI Foam Pump',
      serialNo: 'SN12588',
      customerName: 'Metro Hospital',
      siteLocation: 'Noida',
      contactPerson: 'Neha Singh',
      mobileNo: '9812345600',
      dateIssued: '2026-03-12',
      salesPerson: 'Rohit',
      status: 'Active',
      expectedReturnDate: '2026-06-20',
      remarks: 'Review before renewal.',
      photoUrl: '',
      updatedAt: '2026-05-22',
    },
    {
      id: 'PUMP-0003',
      model: 'Diversey Wall Pump',
      serialNo: 'SN12890',
      customerName: '',
      siteLocation: 'Warehouse',
      contactPerson: '',
      mobileNo: '',
      dateIssued: '',
      salesPerson: 'Inventory',
      status: 'Available',
      expectedReturnDate: '',
      remarks: 'Ready to issue.',
      photoUrl: '',
      updatedAt: '2026-05-25',
    },
  ]);
}

function readRecords(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  return sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues().map(rowToRecord);
}

function replaceRecords(sheet, records) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent();
  }
  if (!records.length) return;
  sheet.getRange(2, 1, records.length, HEADERS.length).setValues(records.map(recordToRow));
}

function upsertRecord(sheet, record) {
  const normalized = normalizeRecord(record);
  if (!normalized.id) throw new Error('Pump ID is required.');
  const records = readRecords(sheet);
  const index = records.findIndex(item => item.id === normalized.id);
  const row = recordToRow(normalized);
  if (index >= 0) {
    sheet.getRange(index + 2, 1, 1, HEADERS.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function deleteRecord(sheet, id) {
  const records = readRecords(sheet);
  const index = records.findIndex(item => item.id === String(id).trim().toUpperCase());
  if (index >= 0) {
    sheet.deleteRow(index + 2);
  }
}

function updateStatus(sheet, id, status, remarks) {
  const rowNumber = findRowNumber(sheet, id);
  if (!rowNumber) throw new Error('Pump record not found.');
  if (status) sheet.getRange(rowNumber, 10).setValue(value(status));
  if (remarks !== undefined) sheet.getRange(rowNumber, 12).setValue(value(remarks));
  sheet.getRange(rowNumber, 14).setValue(new Date().toISOString().slice(0, 10));
}

function updateAssignment(sheet, id, fields) {
  const rowNumber = findRowNumber(sheet, id);
  if (!rowNumber) throw new Error('Pump record not found.');
  const allowedColumns = {
    customerName: 4,
    siteLocation: 5,
    contactPerson: 6,
    mobileNo: 7,
    dateIssued: 8,
    salesPerson: 9,
    status: 10,
    expectedReturnDate: 11,
    remarks: 12,
    photoUrl: 13,
  };
  Object.keys(allowedColumns).forEach(key => {
    if (fields[key] !== undefined) {
      sheet.getRange(rowNumber, allowedColumns[key]).setValue(value(fields[key]));
    }
  });
  sheet.getRange(rowNumber, 14).setValue(new Date().toISOString().slice(0, 10));
}

function findRowNumber(sheet, id) {
  const records = readRecords(sheet);
  const index = records.findIndex(item => item.id === String(id).trim().toUpperCase());
  return index >= 0 ? index + 2 : null;
}

function rowToRecord(row) {
  return {
    id: value(row[0]),
    model: value(row[1]),
    serialNo: value(row[2]),
    customerName: value(row[3]),
    siteLocation: value(row[4]),
    contactPerson: value(row[5]),
    mobileNo: value(row[6]),
    dateIssued: dateValue(row[7]),
    salesPerson: value(row[8]),
    status: value(row[9]) || 'Available',
    expectedReturnDate: dateValue(row[10]),
    remarks: value(row[11]),
    photoUrl: value(row[12]),
    updatedAt: dateValue(row[13]),
  };
}

function recordToRow(record) {
  const item = normalizeRecord(record);
  return [
    item.id,
    item.model,
    item.serialNo,
    item.customerName,
    item.siteLocation,
    item.contactPerson,
    item.mobileNo,
    item.dateIssued,
    item.salesPerson,
    item.status,
    item.expectedReturnDate,
    item.remarks,
    item.photoUrl,
    item.updatedAt,
  ];
}

function normalizeRecord(record) {
  return {
    id: value(record.id || record['Pump ID']).toUpperCase(),
    model: value(record.model || record['Pump Model']),
    serialNo: value(record.serialNo || record['Serial No.']),
    customerName: value(record.customerName || record['Customer Name']),
    siteLocation: value(record.siteLocation || record['Site Location']),
    contactPerson: value(record.contactPerson || record['Contact Person']),
    mobileNo: value(record.mobileNo || record['Mobile No.']),
    dateIssued: dateValue(record.dateIssued || record['Date Issued']),
    salesPerson: value(record.salesPerson || record['Sales Person']),
    status: value(record.status || record.Status) || 'Available',
    expectedReturnDate: dateValue(record.expectedReturnDate || record['Expected Return Date']),
    remarks: value(record.remarks || record.Remarks),
    photoUrl: value(record.photoUrl || record['Photo URL']),
    updatedAt: dateValue(record.updatedAt || record['Updated At']) || new Date().toISOString().slice(0, 10),
  };
}

function value(input) {
  return input === null || input === undefined ? '' : String(input).trim();
}

function dateValue(input) {
  if (!input) return '';
  if (Object.prototype.toString.call(input) === '[object Date]') {
    return Utilities.formatDate(input, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(input).trim();
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

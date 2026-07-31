/* ==========================================================================
   ForgeX Database Abstraction Layer — js/forgex-db.js
   -----------------------------------------------------------------------
   This is the ONLY file that is allowed to touch localStorage directly.
   Every page talks to data through window.ForgeXDB (detailed collection API)
   or window.database (flat, cloud-migration-friendly alias — see bottom).

   MIGRATION NOTE: to move this app to Firebase/Supabase, this is the only
   file that needs to change. Replace the body of each method below with a
   network call that returns/receives the same shapes, and every page in
   the app keeps working unmodified.
   ========================================================================== */
(function (global) {
  'use strict';

  var APP_VERSION = '1.0.0';

  var KEYS = {
    customers: 'forgex.customers',
    projects: 'forgex.projects',
    consultations: 'forgex.consultations',
    attachments: 'forgex.attachments',
    reports: 'forgex.reports',
    settings: 'forgex.settings',
    users: 'forgex.users',
    draft: 'forgex.consultationDraft',
    meta: 'forgex.meta'
  };

  /* Project lifecycle — New Lead -> ... -> Completed, with Rejected as a branch
     that can happen from any stage rather than a forced last step. */
  var STATUSES = [
    { value: 'عميل محتمل',   className: 'status-lead',          order: 1 },
    { value: 'استشارة',       className: 'status-consultation',  order: 2 },
    { value: 'مراجعة هندسية', className: 'status-review',        order: 3 },
    { value: 'عرض سعر',       className: 'status-quotation',     order: 4 },
    { value: 'معتمد',         className: 'status-approved',      order: 5 },
    { value: 'تصنيع',         className: 'status-manufacturing', order: 6 },
    { value: 'مكتمل',         className: 'status-completed',     order: 7 },
    { value: 'مرفوض',         className: 'status-rejected',      order: 0 }
  ];

  var FILE_RULES = {
    maxSizeMB: 10,
    allowedExtensions: ['jpg','jpeg','png','gif','webp','pdf','dwg','dxf','step','stp','iges','igs'],
    imageExtensions: ['jpg','jpeg','png','gif','webp'],
    maxImageBase64SizeMB: 4
  };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : (fallback !== undefined ? fallback : null);
    } catch (err) {
      console.warn('ForgeXDB: could not read', key, err);
      return fallback !== undefined ? fallback : null;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      global.dispatchEvent(new CustomEvent('forgex:db:change', { detail: { key: key } }));
      return true;
    } catch (err) {
      console.warn('ForgeXDB: could not write', key, err);
      if (global.ForgeXUI && typeof global.ForgeXUI.toast === 'function') {
        global.ForgeXUI.toast('تعذّر حفظ البيانات — قد تكون مساحة التخزين ممتلئة', 'error');
      }
      return false;
    }
  }

  function genId(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function nowIso() { return new Date().toISOString(); }

  function nextSeq(bucket) {
    var meta = read(KEYS.meta, { sequences: {} });
    if (!meta.sequences) meta.sequences = {};
    var year = new Date().getFullYear();
    var mapKey = bucket + ':' + year;
    var seq = (meta.sequences[mapKey] || 0) + 1;
    meta.sequences[mapKey] = seq;
    write(KEYS.meta, meta);
    return { year: year, seq: seq };
  }
  function nextProjectCode() {
    var n = nextSeq('project');
    return 'FGX-' + n.year + '-' + String(n.seq).padStart(4, '0');
  }
  function nextReportNumber() {
    var n = nextSeq('report');
    return 'RPT-' + n.year + '-' + String(n.seq).padStart(4, '0');
  }

  function makeCollection(key, idPrefix) {
    return {
      getAll: function () { return read(key, []); },
      getById: function (id) { return read(key, []).find(function (r) { return r.id === id; }) || null; },
      create: function (obj) {
        var list = read(key, []);
        var record = Object.assign({ id: genId(idPrefix), createdAt: nowIso(), updatedAt: nowIso() }, obj);
        list.unshift(record);
        write(key, list);
        return record;
      },
      update: function (id, patch) {
        var list = read(key, []);
        var idx = list.findIndex(function (r) { return r.id === id; });
        if (idx === -1) return null;
        list[idx] = Object.assign({}, list[idx], patch, { updatedAt: nowIso() });
        write(key, list);
        return list[idx];
      },
      remove: function (id) {
        var list = read(key, []);
        var next = list.filter(function (r) { return r.id !== id; });
        write(key, next);
        return next.length !== list.length;
      }
    };
  }

  var customersCol = makeCollection(KEYS.customers, 'cus');
  var projectsCol = makeCollection(KEYS.projects, 'prj');
  var consultationsCol = makeCollection(KEYS.consultations, 'con');
  var reportsCol = makeCollection(KEYS.reports, 'rep');
  var usersCol = makeCollection(KEYS.users, 'usr');

  var customers = Object.assign({}, customersCol, {
    search: function (query) {
      query = (query || '').trim().toLowerCase();
      if (!query) return customersCol.getAll();
      return customersCol.getAll().filter(function (c) {
        return [c.companyName, c.contactPerson, c.phone, c.email, c.industry]
          .filter(Boolean).some(function (f) { return f.toLowerCase().indexOf(query) !== -1; });
      });
    },
    history: function (customerId) {
      return projectsCol.getAll().filter(function (p) { return p.customerId === customerId; });
    },
    findByCompanyName: function (name) {
      var norm = (name || '').trim().toLowerCase();
      if (!norm) return null;
      return customersCol.getAll().find(function (c) { return (c.companyName || '').trim().toLowerCase() === norm; }) || null;
    }
  });

  var projects = Object.assign({}, projectsCol, {
    nextCode: nextProjectCode,
    search: function (query) {
      query = (query || '').trim().toLowerCase();
      if (!query) return projectsCol.getAll();
      return projectsCol.getAll().filter(function (p) {
        return [p.code, p.customerName, p.serviceType, p.status, p.engineer, formatDateFull(p.createdAt)]
          .filter(Boolean).some(function (f) { return String(f).toLowerCase().indexOf(query) !== -1; });
      });
    },
    byStatus: function (status) {
      return projectsCol.getAll().filter(function (p) { return p.status === status; });
    },
    setStatus: function (id, newStatus, note) {
      var list = read(KEYS.projects, []);
      var idx = list.findIndex(function (r) { return r.id === id; });
      if (idx === -1) return null;
      var proj = list[idx];
      var history = proj.history || [];
      history.push({ status: newStatus, changedAt: nowIso(), note: note || '' });
      list[idx] = Object.assign({}, proj, { status: newStatus, history: history, updatedAt: nowIso() });
      write(KEYS.projects, list);
      return list[idx];
    }
  });

  var attachments = {
    getAll: function () { return read(KEYS.attachments, []); },
    getByProject: function (projectId) {
      return read(KEYS.attachments, []).filter(function (a) { return a.projectId === projectId; });
    },
    validateFile: function (file) {
      var ext = (file.name.split('.').pop() || '').toLowerCase();
      if (FILE_RULES.allowedExtensions.indexOf(ext) === -1) {
        return { valid: false, reason: 'صيغة الملف "' + ext + '" غير مدعومة' };
      }
      if (file.size > FILE_RULES.maxSizeMB * 1024 * 1024) {
        return { valid: false, reason: 'حجم الملف يتجاوز الحد الأقصى (' + FILE_RULES.maxSizeMB + ' MB)' };
      }
      return { valid: true, ext: ext, isImage: FILE_RULES.imageExtensions.indexOf(ext) !== -1 };
    },
    addMany: function (projectId, files) {
      var list = read(KEYS.attachments, []);
      var added = (files || []).map(function (f) {
        return {
          id: genId('att'), projectId: projectId, name: f.name, size: f.size,
          ext: f.ext, isImage: !!f.isImage, dataUrl: f.dataUrl || null, uploadedAt: nowIso()
        };
      });
      write(KEYS.attachments, list.concat(added));
      return added;
    },
    remove: function (id) {
      var list = read(KEYS.attachments, []);
      write(KEYS.attachments, list.filter(function (a) { return a.id !== id; }));
    }
  };

  var reports = Object.assign({}, reportsCol, { nextNumber: nextReportNumber });

  var DEFAULT_SETTINGS = {
    companyName: 'ForgeX للاستشارات الهندسية',
    logoDataUrl: null,
    address: 'الرياض، المملكة العربية السعودية',
    email: 'info@forgex.example',
    phone: '0112223344',
    defaultEngineer: 'م. سالم العتيبي',
    theme: 'light',
    language: 'ar'
  };
  var settings = {
    get: function () { return Object.assign({}, DEFAULT_SETTINGS, read(KEYS.settings, {})); },
    update: function (patch) {
      var current = this.get();
      var next = Object.assign({}, current, patch);
      write(KEYS.settings, next);
      return next;
    }
  };

  var users = usersCol;

  var draft = {
    save: function (payload) { payload.savedAt = nowIso(); return write(KEYS.draft, payload); },
    load: function () { return read(KEYS.draft, null); },
    clear: function () { try { localStorage.removeItem(KEYS.draft); } catch (e) {} }
  };

  function globalSearch(query) {
    query = (query || '').trim().toLowerCase();
    if (!query) return { customers: [], projects: [] };
    var matchedCustomers = customersCol.getAll().filter(function (c) {
      return [c.companyName, c.contactPerson, c.phone, c.email, c.industry]
        .filter(Boolean).some(function (f) { return f.toLowerCase().indexOf(query) !== -1; });
    });
    var matchedProjects = projectsCol.getAll().filter(function (p) {
      return [p.code, p.customerName, p.serviceType, p.status, p.engineer, formatDateFull(p.createdAt)]
        .filter(Boolean).some(function (f) { return String(f).toLowerCase().indexOf(query) !== -1; });
    });
    return { customers: matchedCustomers.slice(0, 6), projects: matchedProjects.slice(0, 6) };
  }

  function exportBackup() {
    return {
      app: 'ForgeX Engineering Consultation System',
      version: APP_VERSION,
      exportedAt: nowIso(),
      data: {
        customers: read(KEYS.customers, []),
        projects: read(KEYS.projects, []),
        consultations: read(KEYS.consultations, []),
        attachments: read(KEYS.attachments, []),
        reports: read(KEYS.reports, []),
        settings: read(KEYS.settings, {}),
        meta: read(KEYS.meta, {})
      }
    };
  }
  function downloadBackup() {
    var backup = exportBackup();
    var blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'forgex-backup-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function validateBackupShape(obj) {
    if (!obj || typeof obj !== 'object') return { valid: false, reason: 'ملف غير صالح' };
    if (!obj.data || typeof obj.data !== 'object') return { valid: false, reason: 'الملف لا يحتوي على بيانات ForgeX صالحة' };
    var required = ['customers', 'projects', 'consultations', 'attachments', 'reports'];
    for (var i = 0; i < required.length; i++) {
      if (!Array.isArray(obj.data[required[i]])) return { valid: false, reason: 'حقل "' + required[i] + '" مفقود أو تالف' };
    }
    return { valid: true };
  }
  function restoreBackup(obj) {
    var check = validateBackupShape(obj);
    if (!check.valid) return check;
    write(KEYS.customers, obj.data.customers);
    write(KEYS.projects, obj.data.projects);
    write(KEYS.consultations, obj.data.consultations);
    write(KEYS.attachments, obj.data.attachments);
    write(KEYS.reports, obj.data.reports);
    if (obj.data.settings) write(KEYS.settings, obj.data.settings);
    if (obj.data.meta) write(KEYS.meta, obj.data.meta);
    return { valid: true };
  }
  function wipeAllData() {
    Object.keys(KEYS).forEach(function (k) { try { localStorage.removeItem(KEYS[k]); } catch (e) {} });
  }

  function formatDateShort(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function formatDateFull(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }
  function statusMeta(status) {
    return STATUSES.find(function (s) { return s.value === status; }) || { value: status, className: 'status-lead', order: 1 };
  }

  function seedIfEmpty() {
    if (read(KEYS.customers, null) !== null) return;

    var c1 = customers.create({ companyName: 'شركة الفولاذ المتحدة', contactPerson: 'م. عبدالله الحربي', phone: '0551234567', email: 'contact@unitedsteel.example', industry: 'تصنيع ثقيل', notes: 'عميل استراتيجي — عقد سنوي نشط.' });
    var c2 = customers.create({ companyName: 'مصانع الخليج للتصنيع', contactPerson: 'م. فهد الدوسري', phone: '0559876543', email: 'info@gulfmanufacturing.example', industry: 'أتمتة صناعية', notes: '' });
    var c3 = customers.create({ companyName: 'مجموعة الطاقة الصناعية', contactPerson: 'م. نورة القحطاني', phone: '0563332211', email: 'ops@energygroup.example', industry: 'طاقة', notes: 'تدقيق سلامة سنوي.' });
    var c4 = customers.create({ companyName: 'شركة الدقة للمعدات', contactPerson: 'م. تركي العنزي', phone: '0567778899', email: 'sales@precisioneq.example', industry: 'معدات دقيقة', notes: '' });

    var seedProjects = [
      { customer: c1, serviceType: 'تشغيل CNC', status: 'استشارة', engineer: 'م. سالم العتيبي', daysAgo: 2 },
      { customer: c2, serviceType: 'تشكيل الصفائح المعدنية', status: 'مراجعة هندسية', engineer: 'م. ريما الشهري', daysAgo: 5 },
      { customer: c3, serviceType: 'قص بالليزر', status: 'مكتمل', engineer: 'م. سالم العتيبي', daysAgo: 12 },
      { customer: c4, serviceType: 'الهندسة العكسية', status: 'عرض سعر', engineer: 'م. خالد المطيري', daysAgo: 1 }
    ];
    seedProjects.forEach(function (sp) {
      var created = new Date(Date.now() - sp.daysAgo * 86400000).toISOString();
      projects.create({
        code: projects.nextCode(), customerId: sp.customer.id, customerName: sp.customer.companyName,
        serviceType: sp.serviceType, status: sp.status, engineer: sp.engineer, createdAt: created, updatedAt: created,
        history: [{ status: sp.status, changedAt: created, note: 'إنشاء أولي' }]
      });
    });

    settings.update({});
  }

  var ForgeXDB = {
    VERSION: APP_VERSION,
    KEYS: KEYS,
    STATUSES: STATUSES,
    FILE_RULES: FILE_RULES,
    customers: customers,
    projects: projects,
    consultations: Object.assign({}, consultationsCol, {
      getByProject: function (projectId) {
        return consultationsCol.getAll().filter(function (c) { return c.projectId === projectId; });
      }
    }),
    attachments: attachments,
    reports: reports,
    settings: settings,
    users: users,
    draft: draft,
    search: { global: globalSearch },
    backup: { export: exportBackup, download: downloadBackup, restore: restoreBackup, validate: validateBackupShape, wipeAll: wipeAllData },
    formatDateShort: formatDateShort,
    formatDateFull: formatDateFull,
    statusMeta: statusMeta,
    seedIfEmpty: seedIfEmpty
  };

  var database = {
    createCustomer: customers.create,
    getCustomers: customers.getAll,
    getCustomer: customers.getById,
    updateCustomer: customers.update,
    deleteCustomer: customers.remove,
    searchCustomers: customers.search,

    createProject: projects.create,
    getProjects: projects.getAll,
    getProject: projects.getById,
    updateProject: projects.update,
    deleteProject: projects.remove,
    setProjectStatus: projects.setStatus,
    nextProjectCode: projects.nextCode,

    createConsultation: ForgeXDB.consultations.create,
    getConsultations: ForgeXDB.consultations.getAll,

    addAttachments: attachments.addMany,
    getAttachments: attachments.getByProject,
    deleteAttachment: attachments.remove,
    validateFile: attachments.validateFile,

    createReport: reports.create,
    getReports: reports.getAll,
    nextReportNumber: reports.nextNumber,

    getSettings: settings.get,
    updateSettings: settings.update,

    exportBackup: exportBackup,
    downloadBackup: downloadBackup,
    restoreBackup: restoreBackup,

    search: globalSearch
  };

  global.ForgeXDB = ForgeXDB;
  global.database = database;

})(window);

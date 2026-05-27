// Second i18n merge — adds keys for PeriodsView mutations and the new
// OrganizationMembersView. Same merge mechanics as tmp-merge-i18n.cjs.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, 'src', 'locales');

const NEW = {
    pageTitles: {
        '/members': { ru: 'Участники', en: 'Members', uz: 'Aʼzolar' },
    },
    periods: {
        createNew:   { ru: 'Новый период', en: 'New period', uz: 'Yangi davr' },
        createTitle: { ru: 'Создать обычный период', en: 'Create regular period', uz: 'Yangi davr yaratish' },
        fields: {
            label:            { ru: 'Название', en: 'Label', uz: 'Nomi' },
            labelPlaceholder: { ru: 'Q1 2026', en: 'Q1 2026', uz: 'Q1 2026' },
            startDate:        { ru: 'Начало', en: 'Start date', uz: 'Boshlanish' },
            endDate:          { ru: 'Окончание', en: 'End date', uz: 'Tugash' },
        },
        actions: {
            lock:   { ru: 'Закрыть', en: 'Lock', uz: 'Yopish' },
            reopen: { ru: 'Открыть', en: 'Reopen', uz: 'Qayta ochish' },
        },
    },
    members: {
        title:       { ru: 'Участники организации', en: 'Organization members', uz: 'Tashkilot aʼzolari' },
        invite:      { ru: 'Пригласить', en: 'Invite', uz: 'Taklif qilish' },
        send:        { ru: 'Отправить', en: 'Send', uz: 'Yuborish' },
        inviteTitle: { ru: 'Новое приглашение', en: 'New invite', uz: 'Yangi taklif' },
        editTitle:   { ru: 'Изменить участника', en: 'Edit member', uz: 'Tahrirlash' },
        empty:       { ru: 'Пока нет участников.', en: 'No members yet.', uz: 'Aʼzo yoʻq.' },
        fields: {
            email:        { ru: 'Email', en: 'Email', uz: 'Email' },
            role:         { ru: 'Роль', en: 'Role', uz: 'Rol' },
            capabilities: { ru: 'Полномочия', en: 'Capabilities', uz: 'Vakolatlar' },
        },
        actions: {
            edit:   { ru: 'Изменить', en: 'Edit', uz: 'Tahrirlash' },
            revoke: { ru: 'Удалить', en: 'Revoke', uz: 'Olib tashlash' },
        },
        status: {
            pending: { ru: 'Ожидает', en: 'Pending', uz: 'Kutilmoqda' },
            revoked: { ru: 'Удалён', en: 'Revoked', uz: 'Olib tashlangan' },
        },
    },
};

function setNested(obj, dotPath, value) {
    const keys = dotPath.split('.');
    let cursor = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (cursor[k] === undefined || typeof cursor[k] !== 'object' || Array.isArray(cursor[k])) cursor[k] = {};
        cursor = cursor[k];
    }
    cursor[keys[keys.length - 1]] = value;
}

function flatten(obj, prefix = '') {
    const out = [];
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? prefix + '.' + k : k;
        if (v && typeof v === 'object' && !Array.isArray(v) && !('ru' in v && 'en' in v && 'uz' in v)) {
            out.push(...flatten(v, key));
        } else {
            out.push([key, v]);
        }
    }
    return out;
}

const entries = flatten(NEW);
for (const locale of ['ru', 'en', 'uz']) {
    const filePath = path.join(DIR, locale + '.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const [key, trio] of entries) setNested(data, key, trio[locale]);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4) + '\n', 'utf8');
    console.log('updated ' + locale + '.json: +' + entries.length + ' keys');
}
